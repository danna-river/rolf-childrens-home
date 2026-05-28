import ProfileCard from "@/components/profileCard";
import type { ChildProfile } from "@/types/profile";

export function ProfileList({ profiles }: { profiles: ChildProfile[] }) {
    if (profiles.length === 0) {
        return <p className="text-gray-500">No children found.</p>
    }
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
            ))}
        </div>
    );
}
