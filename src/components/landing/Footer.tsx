import { motion } from 'framer-motion';
import { Instagram, Facebook, Twitter, Mail, MapPin, Phone } from 'lucide-react';

const footerLinks = {
  producto: [
    { name: 'Características', href: '#features' },
    { name: 'Precios', href: '#pricing' },
    { name: 'Demo', href: '#how-it-works' },
    { name: 'Actualizaciones', href: '#' },
  ],
  empresa: [
    { name: 'Sobre Nosotros', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Prensa', href: '#' },
    { name: 'Trabajá con Nosotros', href: '#' },
  ],
  soporte: [
    { name: 'Centro de Ayuda', href: '#' },
    { name: 'Contacto', href: '#' },
    { name: 'Estado del Sistema', href: '#' },
    { name: 'Términos de Servicio', href: '#' },
  ],
};

const socialLinks = [
  { name: 'Instagram', icon: Instagram, href: '#' },
  { name: 'Facebook', icon: Facebook, href: '#' },
  { name: 'Twitter', icon: Twitter, href: '#' },
];

export const Footer = () => {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="relative bg-dark-50 border-t border-dark-200">
      <div className="max-w-7xl mx-auto section-padding py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <motion.a
              href="#hero"
              onClick={(e) => { e.preventDefault(); scrollToSection('#hero'); }}
              className="inline-block mb-6"
              whileHover={{ scale: 1.05 }}
            >
              <img 
                src="/logos/Asset 2fair padel.png" 
                alt="FairPadel" 
                className="h-12 w-auto"
              />
            </motion.a>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              La plataforma líder de gestión de torneos de pádel en Paraguay. 
              Organizá, jugá, ganá.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-dark-100 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="text-white font-semibold mb-4">Producto</h4>
            <ul className="space-y-3">
              {footerLinks.producto.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    onClick={(e) => { 
                      if (link.href.startsWith('#')) {
                        e.preventDefault(); 
                        scrollToSection(link.href); 
                      }
                    }}
                    className="text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Empresa</h4>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Soporte</h4>
            <ul className="space-y-3">
              {footerLinks.soporte.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact Bar */}
        <div className="flex flex-wrap gap-6 py-8 border-t border-dark-200 mb-8">
          <a href="mailto:hola@fairpadel.com" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm">
            <Mail className="w-4 h-4" />
            hola@fairpadel.com
          </a>
          <a href="tel:+595981123456" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm">
            <Phone className="w-4 h-4" />
            +595 981 123 456
          </a>
          <span className="flex items-center gap-2 text-gray-400 text-sm">
            <MapPin className="w-4 h-4" />
            Asunción, Paraguay
          </span>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-dark-200">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} FairPadel. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-500 hover:text-primary transition-colors text-sm">
              Privacidad
            </a>
            <a href="#" className="text-gray-500 hover:text-primary transition-colors text-sm">
              Términos
            </a>
            <a href="#" className="text-gray-500 hover:text-primary transition-colors text-sm">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
