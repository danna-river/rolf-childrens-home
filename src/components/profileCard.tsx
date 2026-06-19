import Link from "next/link";
import { ChildProfile } from "@/types/profile";

export default function ProfileCard({ profile }: { profile: ChildProfile }) {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unnamed"
    const isActive = profile.status === "active"

    const formattedLastUpdate = profile.updatedAt
        ? new Date(profile.updatedAt).toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }) + ' PT'
        : null;

    return (
        <div className="relative">
            <Link href={`/dashboard/children/${profile.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`View ${name}'s profile`} />
            <article className="rounded-xl border p-4 flex gap-4 items-start bg-white">
                {profile.profilePictureURL ? (
                    <img
                        src={profile.profilePictureURL}
                        alt={name}
                        className="h-14 w-14 rounded-full object-cover shrink-0"
                    />
                ) : (
                    <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <span className="text-gray-700 text-lg font-semibold">
                            {profile.firstName?.[0] ?? "?"}
                        </span>
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h2 className="text-lg font-semibold truncate">{name}</h2>
                            <span className={`text-sm px-2.5 py-1 rounded-full font-semibold shrink-0 ${isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                                {profile.status}
                            </span>
                        </div>
                        <Link
                            href={`/dashboard/children/${profile.id}/edit`}
                            className="relative z-10 shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
                        >
                            Edit
                        </Link>
                    </div>
                    <p className="text-base font-medium text-gray-900 mt-1">{profile.id_rolf || "ROLF ID Unknown"}</p>
                    <p className="text-base text-gray-700">{profile.birthDay && profile.birthMonth && profile.birthYear ? `Birthdate: ${profile.birthDay}/${profile.birthMonth}/${profile.birthYear}` : "Date of birth unknown"}</p>
                    <p className="text-base text-gray-700">
                        {typeof profile.age === 'number' && profile.age >= 0 ? `${profile.age} years old` : "Age unknown"}
                    </p>
                    <p className="text-base text-gray-700">{profile.date_joined ? `Joined: ${new Date(profile.date_joined).getFullYear()}` : profile.year_joined ? `Joined: ${profile.year_joined}` : "Year joined unknown"}</p>
                    <p className="text-sm text-gray-600">
                        Last Updated:{' '}
                        {profile.updatedAt ? (
                            new Date(profile.updatedAt).toLocaleString('en-US', {
                                timeZone: 'America/Los_Angeles',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            }) + ' PT'
                        ) : (
                            'Never edited'
                        )}
                    </p>
                </div>
            </article>
        </div>
    );
}
