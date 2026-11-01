import { Neurolib } from "@/components/Neurolib";

export default async function NeurolibPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const { folder } = await searchParams;
  return <Neurolib folderId={folder} />;
}
