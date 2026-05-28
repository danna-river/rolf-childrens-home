import ProfileCard from "@/components/profileCard";
import { mockChildProfiles } from "@/lib/mockData";

export default function ProfileList() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockChildProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
            ))}
        </div>
    );
}