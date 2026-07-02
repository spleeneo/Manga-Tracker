import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "../../../../auth";
import { prisma } from "@/lib/db";
import { ParentalControlsSettings } from "@/components/parental-controls-settings";

export default async function ParentalControlsPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const childLink = await prisma.parentChildLink.findUnique({ where: { childId: session.user.id }, select: { status: true } });
  if (childLink?.status === "ACTIVE") return <main className="page-wrap py-12"><div className="surface mx-auto max-w-lg rounded-lg p-8 text-center"><h1 className="text-2xl font-bold">Parental controls are managed by your parent</h1><Link href="/" className="ui-button ui-button-primary mt-6">Back to library</Link></div></main>;
  return <main className="page-wrap py-8"><div className="mb-6"><Link href="/" className="text-sm text-muted-foreground">← Back to library</Link><h1 className="mt-3 text-3xl font-bold">Parental controls</h1><p className="mt-2 text-muted-foreground">Manage linked child accounts and content policies.</p></div><ParentalControlsSettings /></main>;
}
