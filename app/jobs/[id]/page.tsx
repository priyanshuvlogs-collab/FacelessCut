import { JobStudio } from "@/components/job-studio";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobStudio jobId={id} />;
}
