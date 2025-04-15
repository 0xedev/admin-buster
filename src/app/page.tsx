// src/app/page.tsx

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forecast - Prediction Market",
  description: "Forecast outcomes!",
  openGraph: {
    title: "Forecast",
    images: ["/icon.jpg"],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://admin-buster.vercel.app/icon.jpg",
      button: {
        title: "Forecast",
        action: {
          type: "launch_frame",
          name: "Forecast",
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
