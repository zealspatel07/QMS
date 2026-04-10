// src/components/Card.tsx
import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  variant?: "default" | "soft" | "flat";
};

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  title,
  variant = "default",
}) => {
  const base =
    "rounded-xl p-6 transition-shadow duration-200";

  const variants = {
    default:
      "bg-white border border-gray-200 shadow-sm hover:shadow-md",
    soft:
      "bg-gray-50 border border-gray-200",
    flat:
      "bg-white border border-gray-100",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
