export interface ChildProfile {
    id: string;
    id_rolf: string | null;
    firstName: string;
    lastName: string;
    birthYear: number;
    birthMonth: number;
    birthDay: number;
    age: number;
    country: string;
    created_by?: string | null;
    createdAt: string | Date;
    updatedAt: string | null;
    year_joined: number;
    date_joined: string | null;
    profilePictureURL: string;
    status: string;
}
