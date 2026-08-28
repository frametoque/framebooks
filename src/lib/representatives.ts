export type Representative = {
  name: string;
  role: string;
  signatureText: string;
  signatureImage?: string | null;
};

export const PREDEFINED_REPRESENTATIVES: Representative[] = [
  {
    name: "Nelitha Priyawansha",
    role: "FrameBookss",
    signatureText: "Nelitha Priyawansha",
    signatureImage: "/admin/agreements/signatures/nelitha.png",
  },
    {
    name: "Kavinu Pasandul",
    role: "FrameBookss",
    signatureText: "Kavinu Pasandul",
    signatureImage: "/admin/agreements/signatures/kavinu.png",
  },
  {
    name: "Tharul Bandara",
    role: "FrameBookss",
    signatureText: "Tharul Bandara",
    signatureImage: "/admin/agreements/signatures/tharul.png",
  },
];
