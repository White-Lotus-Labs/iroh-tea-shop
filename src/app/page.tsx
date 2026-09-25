import TeaRoomShell from '../ui/TeaRoomShell';
import { getCurrentUser } from '../auth/current-user';

export default async function Page() {
  const user = await getCurrentUser();
  return <TeaRoomShell key={user?.id ?? 'guest'} user={user} />;
}
