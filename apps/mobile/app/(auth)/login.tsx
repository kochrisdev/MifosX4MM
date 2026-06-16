import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState(
    __DEV__ ? (process.env.EXPO_PUBLIC_DEV_USERNAME ?? '') : ''
  );
  const [password, setPassword] = useState(
    __DEV__ ? (process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '') : ''
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.card}>
        <Text style={s.logo}>Mifos X</Text>
        <Text style={s.subtitle}>Field Operations</Text>

        <View style={s.form}>
          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            placeholder="loan.officer"
          />

          <Text style={[s.label, { marginTop: 14 }]}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign in</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const BLUE = '#0284c7';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f9ff', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  logo: { fontSize: 26, fontWeight: '700', color: '#0c4a6e' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2, marginBottom: 24 },
  form: {},
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 10 },
  btn: { backgroundColor: BLUE, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
