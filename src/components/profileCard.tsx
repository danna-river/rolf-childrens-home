import { ChildProfile } from "@/types/profile";

export default function ProfileCard({ profile }: { profile: ChildProfile }) {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unnamed"
    const isActive = profile.status === "active"
    const displayDate = profile.createdAt 
        ? new Date(profile.createdAt).toLocaleDateString() 
        : "No date recorded"

    return (
        <article className="rounded-xl border p-4 flex gap-4 items-start">
            {profile.profilePictureURL ? (
                <img
                    src={profile.profilePictureURL}
                    alt={name}
                    className="h-14 w-14 rounded-full object-cover shrink-0"
                />
            ) : (
                <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <span className="text-gray-500 text-lg font-semibold">
                        {profile.firstName?.[0] ?? "?"}
                    </span>
                </div>
            )}
            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold truncate">{name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {profile.status}
                    </span>
                </div>
                <p className="text-sm text-gray-500">{profile.age > 0 ? `${profile.age} years old` : "Age unknown"}</p>
                <p className="text-sm text-gray-500">{profile.country || "Country unknown"}</p>
                <p className="text-xs text-gray-400 mt-1">{profile.createdAt.toLocaleDateString()}</p>
            </div>
        </article>
    );
}
