import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mifos X Field</Text>
      <Text style={styles.subtitle}>Loan officer mobile portal</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f9ff' },
  title: { fontSize: 24, fontWeight: '700', color: '#0c4a6e' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
});
