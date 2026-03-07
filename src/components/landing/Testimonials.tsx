import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { FadeIn } from '../components/AnimatedSection';

const testimonials = [
  {
    name: 'Carlos Martínez',
    role: 'Organizador • Club PadelPY',
    content: 'Antes usaba Excel y WhatsApp para organizar torneos. Era un caos. Con FairPadel, en 10 minutos tengo todo listo y los jugadores ven el fixture en tiempo real. Increíble.',
    rating: 5,
    avatar: 'CM',
  },
  {
    name: 'María González',
    role: 'Jugadora • Categoría 4ta',
    content: 'Me encanta poder ver mis partidos, resultados y ranking desde el celular. Las notificaciones me avisan cuando juego. Muy profesional todo.',
    rating: 5,
    avatar: 'MG',
  },
  {
    name: 'Roberto Silva',
    role: 'Dueño • Sede Padel Zone',
    content: 'Integramos FairPadel para gestionar alquileres y torneos. Los ingresos aumentaron 40% porque ahora todo está organizado y los clientes confían más.',
    rating: 5,
    avatar: 'RS',
  },
];

export const Testimonials = () => {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto section-padding">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-primary font-semibold text-sm tracking-wider uppercase mb-4"
          >
            Testimonios
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="heading-lg text-white mb-6"
          >
            Lo que dicen los que ya usan{' '}
            <span className="text-gradient">FairPadel</span>
          </motion.h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.name} delay={index * 0.15}>
              <motion.div
                whileHover={{ y: -5 }}
                className="glass rounded-2xl p-8 h-full border border-transparent hover:border-primary/20 transition-all duration-500"
              >
                {/* Quote Icon */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Quote className="w-5 h-5 text-primary" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-gray-300 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{testimonial.name}</p>
                    <p className="text-gray-500 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-20 glass rounded-2xl p-8 md:p-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-gradient mb-2">98%</p>
              <p className="text-gray-400 text-sm">Satisfacción</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gradient mb-2">4.9</p>
              <p className="text-gray-400 text-sm">Rating promedio</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gradient mb-2">85%</p>
              <p className="text-gray-400 text-sm">Recomiendan</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gradient mb-2">24/7</p>
              <p className="text-gray-400 text-sm">Soporte</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
