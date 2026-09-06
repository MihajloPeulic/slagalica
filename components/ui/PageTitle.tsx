type PageTitleProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
};

export default function PageTitle({
  title,
  eyebrow,
  description,
  className = "",
}: PageTitleProps) {
  return (
    <div
      className={`page-title-block ${className}`}
    >
      {eyebrow && (
        <p className="eyebrow">
          {eyebrow}
        </p>
      )}

      <h1 className="page-title">
        {title}
      </h1>

      {description && (
        <p className="secondary-text mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}