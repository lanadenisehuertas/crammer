import { Badge } from "./ui";

export function OriginBadge({ origin }: { origin: string }) {
  const isFile = origin === "from-file";
  return (
    <Badge tone={isFile ? "mint" : "lav"}>{isFile ? "From file" : "Added context"}</Badge>
  );
}
