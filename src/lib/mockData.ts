import { ChildProfile } from "@/types/profile";

export const mockChildProfiles: ChildProfile[] = [
    {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        birthYear: 2000,
        birthMonth: 1,
        birthDay: 1,
        age: 20,
        country: "United States",
        createdAt: new Date("2026-05-27"),
        profilePictureURL: "https://via.placeholder.com/150",
    },
    {
        id: "2",
        firstName: "Jane",
        lastName: "Doe",
        birthYear: 2002,
        birthMonth: 2,
        birthDay: 2,
        age: 20,
        country: "United States",
        createdAt: new Date("2026-05-27"),
        profilePictureURL: "https://via.placeholder.com/150",
    },
];