import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, Linking, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { DollarSign, CreditCard, X, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { useLoan, usePostRepayment, useInitiateKbzPayment } from '../../src/hooks/useLoans';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { fmt } from '../../src/lib/format';
import type { ApiResponse, KbzPayStatusResponse } from '@mifos-x/shared-types';

type PaymentMethod = 'cash' | 'kbzpay';

export default function LoanDetailScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const navigation = useNavigation();
  const { data: loan, isLoading } = useLoan(loanId);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (loan) navigation.setOptions({ title: `Loan #${loan.accountNo}` });
  }, [loan]);

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#0284c7" />;
  if (!loan) return <View style={s.center}><Text style={s.muted}>Loan not found</Text></View>;

  const outstanding = loan.summary?.totalOutstanding ?? 0;
  const overdue = loan.summary?.totalOverdue ?? 0;
  const schedule: RepaymentPeriod[] = (loan as any).repaymentSchedule?.periods ?? [];
  const upcoming = schedule.filter((p) => p.obligationsMetOnDate == null && p.dueDate).slice(0, 5);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.productName}>{loan.loanProductName}</Text>

          <View style={s.summaryRow}>
            <SummaryItem label="Principal" value={fmt.mmk(loan.approvedPrincipal ?? loan.principal)} />
            <SummaryItem label="Outstanding" value={fmt.mmk(outstanding)} highlight={outstanding > 0} />
          </View>

          {overdue > 0 && (
            <View style={s.overdueAlert}>
              <AlertTriangle size={14} color="#b45309" />
              <Text style={s.overdueText}>Overdue: {fmt.mmk(overdue)}</Text>
            </View>
          )}

          <View style={s.metaRow}>
            <Text style={s.metaText}>
              {loan.numberOfRepayments} repayments · {loan.repaymentEvery} {loan.repaymentFrequencyType?.value}
            </Text>
            <Text style={s.metaText}>{loan.annualInterestRate}% p.a.</Text>
          </View>
        </View>

        {/* Status timeline */}
        <View style={s.timelineCard}>
          {loan.timeline?.actualDisbursementDate && (
            <TimelineRow label="Disbursed" date={loan.timeline.actualDisbursementDate} done />
          )}
          {loan.timeline?.expectedMaturityDate && (
            <TimelineRow label="Matures" date={loan.timeline.expectedMaturityDate} />
          )}
        </View>

        {/* Upcoming schedule */}
        {upcoming.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Upcoming Installments</Text>
            {upcoming.map((period, i) => (
              <ScheduleRow key={i} period={period} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Record repayment button — always visible at bottom */}
      {['Active', 'Approved'].includes(loan.status.value) && (
        <View style={s.footer}>
          <TouchableOpacity style={s.recordBtn} onPress={() => setShowModal(true)}>
            <DollarSign size={18} color="#fff" />
            <Text style={s.recordBtnText}>Record Repayment</Text>
          </TouchableOpacity>
        </View>
      )}

      <RepaymentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        loanId={loanId}
        clientName={loan.clientName}
        outstanding={outstanding}
      />
    </View>
  );
}

// ── Repayment modal ─────────────────────────────────────────────────────────

interface RepaymentModalProps {
  visible: boolean;
  onClose: () => void;
  loanId: string;
  clientName: string;
  outstanding: number;
}

function RepaymentModal({ visible, onClose, loanId, clientName, outstanding }: RepaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [kbzOrderId, setKbzOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'entry' | 'kbz_pending' | 'success'>('entry');

  const postRepayment = usePostRepayment();
  const initiateKbz = useInitiateKbzPayment();

  // Poll KBZ Pay status after opening the app
  const { data: kbzStatus } = useQuery<KbzPayStatusResponse>({
    queryKey: ['kbzpay', 'status', kbzOrderId],
    enabled: !!kbzOrderId && step === 'kbz_pending',
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<KbzPayStatusResponse>>(
        `/payments/status/${kbzOrderId}`,
        { params: { loanId } }
      );
      return data.data!;
    },
  });

  useEffect(() => {
    if (kbzStatus?.status === 'success') setStep('success');
  }, [kbzStatus]);

  function reset() {
    setAmount('');
    setMethod('cash');
    setKbzOrderId(null);
    setStep('entry');
  }

  async function handleCash() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Invalid amount');
    await postRepayment.mutateAsync({ loanId, amount: amt });
    setStep('success');
  }

  async function handleKbzPay() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Invalid amount');

    const result = await initiateKbz.mutateAsync({
      loanId: Number(loanId),
      amount: amt * 100, // convert MMK to pyas
      customerName: clientName,
      customerPhone: '',
    });

    setKbzOrderId(result.orderId);

    // Deep-link into KBZ Pay app
    // KBZ Pay uses a custom URL scheme: kbzpay://pay?prepay_id=xxx&...
    const kbzUrl = buildKbzDeepLink(result.prepayId, result.orderId);
    const canOpen = await Linking.canOpenURL(kbzUrl);
    if (canOpen) {
      await Linking.openURL(kbzUrl);
      setStep('kbz_pending');
    } else {
      Alert.alert('KBZ Pay not installed', 'Please install the KBZ Pay app to use this payment method.');
    }
  }

  function buildKbzDeepLink(prepayId: string, orderId: string) {
    // KBZ Pay in-app payment deep link format (from SDK docs)
    return `kbzpay://pay?prepay_id=${prepayId}&merch_order_id=${orderId}`;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={m.root}>
          {/* Header */}
          <View style={m.header}>
            <Text style={m.title}>Record Repayment</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <X size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {step === 'success' ? (
            <View style={m.successWrap}>
              <CheckCircle2 size={56} color="#10b981" />
              <Text style={m.successTitle}>Payment recorded</Text>
              <Text style={m.successSub}>{fmt.mmk(parseFloat(amount) || 0)} posted to loan</Text>
              <TouchableOpacity style={m.doneBtn} onPress={() => { reset(); onClose(); }}>
                <Text style={m.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'kbz_pending' ? (
            <View style={m.successWrap}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={m.successTitle}>Awaiting KBZ Pay</Text>
              <Text style={m.successSub}>Complete the payment in the KBZ Pay app,{'\n'}then return here.</Text>
              <Text style={m.statusPoll}>
                Status: {kbzStatus?.status ?? 'checking…'}
              </Text>
              <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }}>
                <Text style={m.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={m.form}>
              <Text style={m.label}>Amount (MMK)</Text>
              <TextInput
                style={m.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={`Outstanding: ${fmt.mmk(outstanding)}`}
                returnKeyType="done"
              />

              <Text style={[m.label, { marginTop: 20 }]}>Payment Method</Text>
              <View style={m.methodRow}>
                <MethodBtn
                  label="Cash"
                  icon={<DollarSign size={18} color={method === 'cash' ? '#0284c7' : '#94a3b8'} />}
                  selected={method === 'cash'}
                  onPress={() => setMethod('cash')}
                />
                <MethodBtn
                  label="KBZ Pay"
                  icon={<CreditCard size={18} color={method === 'kbzpay' ? '#0284c7' : '#94a3b8'} />}
                  selected={method === 'kbzpay'}
                  onPress={() => setMethod('kbzpay')}
                />
              </View>

              <TouchableOpacity
                style={[m.submitBtn, (postRepayment.isPending || initiateKbz.isPending) && m.btnDisabled]}
                onPress={method === 'cash' ? handleCash : handleKbzPay}
                disabled={postRepayment.isPending || initiateKbz.isPending}
              >
                {postRepayment.isPending || initiateKbz.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={m.submitText}>
                      {method === 'kbzpay' ? 'Open KBZ Pay' : 'Confirm Payment'}
                    </Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface RepaymentPeriod {
  period: number;
  dueDate: string;
  obligationsMetOnDate?: string;
  totalDueForPeriod: number;
  totalOutstandingForPeriod: number;
  currency?: { code: string };
}

function ScheduleRow({ period }: { period: RepaymentPeriod }) {
  const isPaid = !!period.obligationsMetOnDate;
  return (
    <View style={s.scheduleRow}>
      <View style={[s.periodDot, { backgroundColor: isPaid ? '#10b981' : '#e2e8f0' }]} />
      <View style={s.scheduleBody}>
        <Text style={s.scheduleDate}>{fmt.date(period.dueDate)}</Text>
        <Text style={s.scheduleAmount}>{fmt.mmk(period.totalDueForPeriod)}</Text>
      </View>
      {isPaid && <CheckCircle2 size={16} color="#10b981" />}
    </View>
  );
}

function SummaryItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.summaryItem}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, highlight && { color: '#ef4444' }]}>{value}</Text>
    </View>
  );
}

function TimelineRow({ label, date, done }: { label: string; date: string; done?: boolean }) {
  return (
    <View style={s.timelineRow}>
      <View style={[s.timelineDot, done && { backgroundColor: '#10b981' }]} />
      <Text style={s.timelineLabel}>{label}</Text>
      <Text style={s.timelineDate}>{fmt.date(date)}</Text>
    </View>
  );
}

function MethodBtn({ label, icon, selected, onPress }: { label: string; icon: React.ReactNode; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[m.methodBtn, selected && m.methodBtnSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon}
      <Text style={[m.methodLabel, selected && m.methodLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const BLUE = '#0284c7';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#94a3b8' },
  summaryCard: {
    backgroundColor: '#0c4a6e', borderRadius: 16, padding: 20, marginBottom: 12,
  },
  productName: { color: '#7dd3fc', fontSize: 13, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  summaryItem: {},
  summaryLabel: { color: '#93c5fd', fontSize: 11, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overdueAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginBottom: 10,
  },
  overdueText: { color: '#92400e', fontSize: 13, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: '#93c5fd', fontSize: 12 },
  timelineCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20,
    gap: 10,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e2e8f0' },
  timelineLabel: { flex: 1, fontSize: 13, color: '#374151' },
  timelineDate: { fontSize: 13, color: '#64748b' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  periodDot: { width: 10, height: 10, borderRadius: 5 },
  scheduleBody: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  scheduleDate: { fontSize: 13, color: '#374151' },
  scheduleAmount: { fontSize: 13, fontWeight: '600', color: '#111827' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  recordBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title: { fontSize: 18, fontWeight: '700', color: '#0c4a6e' },
  form: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: '#111827' },
  methodRow: { flexDirection: 'row', gap: 12 },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0',
  },
  methodBtnSelected: { borderColor: BLUE, backgroundColor: '#e0f2fe' },
  methodLabel: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  methodLabelSelected: { color: BLUE },
  submitBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 8 },
  successSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  statusPoll: { fontSize: 13, color: '#94a3b8', marginTop: 8 },
  doneBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 16 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  cancelBtnText: { color: '#64748b', fontSize: 14 },
});
