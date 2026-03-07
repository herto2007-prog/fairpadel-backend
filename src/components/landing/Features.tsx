import { motion } from 'framer-motion';
import { 
  Trophy, 
  Users, 
  Calendar, 
  CreditCard, 
  BarChart3, 
  Shield, 
  Zap,
  Award
} from 'lucide-react';
import { StaggerContainer, StaggerItem } from '../components/AnimatedSection';

const features = [
  {
    icon: Trophy,
    title: 'Fixture Automático',
    description: 'Genera brackets profesionales con sistema de acomodación paraguaya. Todos juegan mínimo 2 partidos.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Users,
    title: 'Gestión de Inscripciones',
    description: 'Inscripción directa de parejas, confirmaciones automáticas y lista de espera inteligente.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Calendar,
    title: 'Scheduling Inteligente',
    description: 'Organiza partidos por cancha y horario automáticamente. Sin conflictos ni solapamientos.',
    color: 'from-purple-500 to-pink-600',
  },
  {
    icon: CreditCard,
    title: 'Pagos Integrados',
    description: 'Cobrá inscripciones online con Bancard. Comprobantes digitales y seguimiento automático.',
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: BarChart3,
    title: 'Rankings en Tiempo Real',
    description: 'Sistema de puntos automático. Rankings globales, por categoría y por sede.',
    color: 'from-red-500 to-rose-600',
  },
  {
    icon: Shield,
    title: 'Todo en la Nube',
    description: 'Accedé desde cualquier dispositivo. Tus torneos siempre disponibles y respaldados.',
    color: 'from-indigo-500 to-violet-600',
  },
  {
    icon: Zap,
    title: 'Notificaciones Push',
    description: 'Jugadores reciben alertas de sus partidos, resultados y próximas fechas automáticamente.',
    color: 'from-yellow-500 to-amber-600',
  },
  {
    icon: Award,
    title: 'Sistema de Categorías',
    description: 'Clasificación automática por nivel. Reglas de ascenso y descenso personalizables.',
    color: 'from-teal-500 to-cyan-600',
  },
];

export const Features = () => {
  return (
    <section id="features" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
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
            Características
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="heading-lg text-white mb-6"
          >
            Todo lo que necesitás para{' '}
            <span className="text-gradient">organizar torneos</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-body text-lg"
          >
            FairPadel incluye todas las herramientas que los organizadores de torneos 
            de pádel necesitan, en una sola plataforma intuitiva y potente.
          </motion.p>
        </div>

        {/* Features Grid */}
        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.1}>
          {features.map((feature, ) => (
            <StaggerItem key={feature.title}>
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative h-full"
              >
                <div className="relative h-full glass rounded-2xl p-6 overflow-hidden transition-all duration-500 hover:border-primary/50">
                  {/* Gradient Background on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  {/* Icon */}
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} p-0.5 mb-5`}>
                    <div className="w-full h-full rounded-xl bg-dark-50 flex items-center justify-center">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Hover Arrow */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    whileHover={{ opacity: 1, x: 0 }}
                    className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary text-lg">→</span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-400 mb-6">
            ¿Y eso no es todo? Tenemos muchas más funcionalidades para vos.
          </p>
          <motion.a
            href="https://fairpadel-frontend-production.up.railway.app/register"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Probar Todas las Features
            <Zap className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};
