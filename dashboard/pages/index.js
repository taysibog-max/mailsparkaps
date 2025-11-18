export default function IndexRedirect() { return null; }

export async function getServerSideProps() {
  // Redirect root to static marketing homepage served from Next public/
  return {
    redirect: {
      destination: '/index.html',
      permanent: false,
    },
  };
}


