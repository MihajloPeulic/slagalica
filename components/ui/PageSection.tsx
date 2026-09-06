import { ReactNode } from "react";

type PageSectionProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

export default function PageSection({
  children,
  title,
  description,
}: PageSectionProps) {
  return (
    <section>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="section-title">
              {title}
            </h2>
          )}

          {description && (
            <p className="secondary-text mt-1">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}