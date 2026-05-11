import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

function MyApp({ Component, pageProps }: AppProps) {
  return <div>
    <Head>
      <title>FunMoov Atelier — Diagnostic VanMoof S3 / X3</title>
      <link rel="icon" type="image/png" href="/compressed_logos/logo_full_64.png" />
      <link rel="manifest" href="/app.webmanifest"></link>
      <meta name="description" content="Outils de diagnostic atelier pour les vélos VanMoof S3 et X3" />
      <meta property="og:title" content="FunMoov Atelier — Diagnostic VanMoof S3 / X3" />
    </Head>
    <Component {...pageProps} />
    <div id="modals" />
  </div>
}

export default MyApp
