import { MessageCircle } from 'lucide-react';

const WHATSAPP_PHONE = '250783021801'; // +250 783 021 801

export function WhatsAppFloatingButton() {
    const href = `https://wa.me/${WHATSAPP_PHONE}`;

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="fixed z-[60] bottom-8 left-5 rounded-full bg-[#22c55e] text-white w-12 h-12 flex items-center justify-center shadow-lg hover:brightness-95 transition-all"
        >
            <MessageCircle size={22} />
        </a>
    );
}

