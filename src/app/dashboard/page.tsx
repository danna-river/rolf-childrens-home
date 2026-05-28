import ProfileList from "./profileList";

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <ProfileList />
    </main>
  );
}