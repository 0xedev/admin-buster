// src/app/page.tsx

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policast - Prediction Market",
  description: "Policast outcomes!",
  openGraph: {
    title: "Policast",
    images: ["/icon.jpg"],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://admin-buster.vercel.app/icon.jpg",
      button: {
        title: "Policast",
        action: {
          type: "launch_frame",
          name: "Policast",
          iconUrl: "https://admin-buster.vercel.app/icon1.jpg",
          url: "https://buster-mkt.vercel.app",
          splashImageUrl: "https://admin-buster.vercel.app/icon.jpg",
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin");
  return null;
}
