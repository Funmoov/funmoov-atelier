import type { NextPage } from 'next'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Ancienne page /donate de moovy.
 * Désactivée pour funmoov atelier : redirection auto vers l'accueil.
 */
const DonateRedirect: NextPage = () => {
    const router = useRouter()
    useEffect(() => {
        router.replace('/')
    }, [router])
    return null
}

export default DonateRedirect
