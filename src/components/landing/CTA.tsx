import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { FadeIn } from './AnimatedSection';

export const CTA = () => {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto section-padding">
        <FadeIn>
          <div className="glass rounded-3xl p-8 md:p-16 text-center border border-primary/30 glow-primary">
            {/* Badge */}
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-medium">Empezá hoy mismo</span>
            </motion.div>

            {/* Headline */}
            <h2 className="heading-lg text-white mb-6">
              ¿Listo para transformar{' '}
              <span className="text-gradient">tus torneos?</span>
            </h2>

            {/* Subheadline */}
            <p className="text-body text-lg mb-10 max-w-2xl mx-auto">
              Unite a los +500 organizadores que ya usan FairPadel. Creá tu primer torneo 
              en minutos y viví la experiencia de tener todo bajo control.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="https://fairpadel-frontend-production.up.railway.app/register"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center justify-center gap-2 text-lg group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Crear Mi Cuenta Gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="https://wa.me/595981123456"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center justify-center gap-2 text-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Hablar con Ventas
              </motion.a>
            </div>

            {/* Trust Text */}
            <p className="mt-8 text-gray-500 text-sm">
              ✓ Setup en 2 minutos • ✓ Sin tarjeta de crédito • ✓ Cancelá cuando quieras
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
