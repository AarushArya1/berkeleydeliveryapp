import { ButtonLink } from "@/components/ui";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-lime-50 px-6 text-center">
      <LogoMark size={56} />
      <h1 className="text-2xl font-extrabold">Nothing here</h1>
      <p className="text-muted">This order may have been cancelled or isn&apos;t yours.</p>
      <ButtonLink href="/">Back to Dart</ButtonLink>
    </div>
  );
}
