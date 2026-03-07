import { motion } from 'framer-motion';
import { UserPlus, Settings, Users, Trophy, ChevronRight } from 'lucide-react';
import { FadeIn } from '../components/AnimatedSection';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Creá tu torneo',
    description: 'Definí el nombre, fechas, sede y categorías en minutos. Configurá el sistema de acomodación y premios.',
    color: 'bg-blue-500',
  },
  {
    number: '02',
    icon: Users,
    title: 'Abrí inscripciones',
    description: 'Compartí el link de inscripción. Los jugadores se registran solos y el sistema confirma automáticamente.',
    color: 'bg-green-500',
  },
  {
    number: '03',
    icon: Settings,
    title: 'Generá el fixture',
    description: 'Con un click, el sistema crea el bracket con sistema paraguayo. Todos juegan mínimo 2 partidos.',
    color: 'bg-purple-500',
  },
  {
    number: '04',
    icon: Trophy,
    title: 'Gestioná resultados',
    description: 'Cargá resultados en tiempo real. Los rankings se actualizan automáticamente y los jugadores ven su progreso.',
    color: 'bg-primary',
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
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
            Cómo Funciona
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="heading-lg text-white mb-6"
          >
            De la idea al torneo en{' '}
            <span className="text-gradient">4 pasos simples</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-body text-lg"
          >
            No necesitás ser experto en tecnología. FairPadel hace todo el trabajo pesado 
            para que vos te enfoques en lo importante: el juego.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-dark-200 to-transparent" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <FadeIn key={step.number} delay={index * 0.15}>
                <motion.div
                  whileHover={{ y: -10 }}
                  className="relative group"
                >
                  {/* Card */}
                  <div className="relative glass rounded-2xl p-8 h-full border border-transparent hover:border-primary/30 transition-all duration-500">
                    {/* Step Number */}
                    <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-dark-100 border border-dark-200 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">{step.number}</span>
                    </div>

                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-2xl ${step.color} bg-opacity-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className={`w-8 h-8 ${step.color.replace('bg-', 'text-')}`} />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {step.description}
                    </p>

                    {/* Arrow for desktop */}
                    {index < steps.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-24 z-10 items-center justify-center w-8 h-8 rounded-full bg-dark-100 border border-dark-200">
                        <ChevronRight className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>

        {/* Video/Demo Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-24 relative"
        >
          <div className="relative glass rounded-3xl overflow-hidden">
            {/* Browser Chrome */}
            <div className="bg-dark-100 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center gap-2 bg-dark px-4 py-1.5 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-primary/20" />
                  <span className="text-gray-400 text-sm">app.fairpadel.com</span>
                </div>
              </div>
            </div>
            
            {/* Mock Interface */}
            <div className="p-8 bg-dark">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Sidebar */}
                <div className="hidden md:block space-y-4">
                  <div className="h-10 bg-dark-50 rounded-lg" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-8 bg-dark-100 rounded-lg w-full" />
                    ))}
                  </div>
                </div>
                
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-8 bg-dark-50 rounded-lg w-48" />
                    <div className="h-8 bg-primary rounded-lg w-32" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-dark-50 rounded-xl" />
                    ))}
                  </div>
                  <div className="h-64 bg-dark-50 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-dark/50 backdrop-blur-sm">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/50"
              >
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
