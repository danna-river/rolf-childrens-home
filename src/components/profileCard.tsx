import { ChildProfile } from "@/types/profile";

export default function ProfileCard({ profile }: { profile: ChildProfile }) {
    return (
        <article className="rounded-xl border p-4">
            <img
                src={profile.profilePictureURL}
                alt={profile.firstName + " " + profile.lastName}
                className="h-16 w-16 rounded-full object-cover"
            />
            <h2 className="text-lg font-semibold">
                {profile.firstName + " " + profile.lastName}
                </h2>
            <p className="text-sm text-gray-500">{profile.age} years old</p>
            <p className="text-sm text-gray-500">{profile.country}</p>
            <p className="text-sm text-gray-500">{profile.createdAt.toLocaleDateString()}</p>
        </article>
    );
}