export default function IndexRedirect() { return null; }

export async function getServerSideProps() {
  const base = process.env.NEXT_PUBLIC_MARKETING_ORIGIN || process.env.MARKETING_ORIGIN;
  const destination = base ? base + '/' : '/dashboard/integrations';
  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}


