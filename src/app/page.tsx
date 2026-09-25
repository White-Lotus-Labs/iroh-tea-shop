import TeaRoomShell from '../ui/TeaRoomShell';
import { getCurrentUser } from '../auth/current-user';
import AuthScreen from '../ui/AuthScreen';

export default async function Page() {
  const user = await getCurrentUser();
  return user ? <TeaRoomShell user={user} /> : <AuthScreen />;
}
