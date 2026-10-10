# SafeSight

Finds things in a home that may be risky or confusing for a person with dementia, based on the Alzheimer's Society guide *Making your home dementia friendly*.

Built at BananaHacks 2026.

## Credits

- [Fancy Components](https://www.fancycomponents.dev) by Daniel Petho (MIT): Vertical Cut Reveal and Text Rotate, via [21st.dev](https://21st.dev). The text highlight in `app/src/components/ui/text-highlight.tsx` is modeled on its Text Highlighter.
- [Magic UI](https://magicui.design) (MIT): the scroll fade in `app/src/components/ui/blur-fade.tsx` is modeled on its Blur Fade.
- [Motion](https://motion.dev) for animation, [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), and the Hanken Grotesk typeface (Google Fonts).
- Website photos are from [Unsplash](https://unsplash.com) (Unsplash License), loaded from Unsplash and never stored in this repo: Clay Banks, Point3D Commercial Imaging Ltd., Lisa Anna, Alex Tyson, Abdul Kayum, David Marquez, avechenri, Brina Blum, Franco Debartolo, CDC, Jakub Żerdzicki and Centre for Ageing Better. Links to each photo are in `backend/tools/stock_photos.py`. The hazards and outlines drawn on them are our pipeline's real output (`backend/tools/annotate_site_images.py`); the findings shown were checked by us, since the starting model also makes mistakes.
- The room in the "Look around" section (`app/public/site/room-wide.jpg`) is AI-generated with OpenAI's GPT-6 Astra, from a prompt we wrote; the findings on it are our pipeline's real output, checked by us.
- An earlier version of the site used images generated with [Stable Diffusion XL 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) (`backend/tools/generate_site_images.py`).
