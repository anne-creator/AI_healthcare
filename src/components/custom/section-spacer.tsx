interface SectionSpacerProps {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "var(--section-gap-sm)",
  md: "var(--section-gap-md)",
  lg: "var(--section-gap-lg)",
};

export function SectionSpacer({ size = "md" }: SectionSpacerProps) {
  return <div style={{ height: sizeMap[size] }} aria-hidden="true" />;
}
