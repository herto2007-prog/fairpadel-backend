import { motion } from 'framer-motion';
import { ArrowRight, Play, Trophy, Users, Calendar } from 'lucide-react';

export const Hero = () => {
  const stats = [
    { icon: Trophy, value: '500+', label: 'Torneos Creados' },
    { icon: Users, value: '10K+', label: 'Jugadores Activos' },
    { icon: Calendar, value: '50+', label: 'Sedes Registradas' },
  ];

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(223, 37, 49, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(223, 37, 49, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto section-padding py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Text */}
          <div className="text-center lg:text-left">
            
            {/* Logo con efecto dramático */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                duration: 1, 
                delay: 0.2,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              className="mb-8 flex justify-center lg:justify-start"
            >
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  filter: [
                    "drop-shadow(0 0 20px rgba(223, 37, 49, 0.3))",
                    "drop-shadow(0 0 40px rgba(223, 37, 49, 0.6))",
                    "drop-shadow(0 0 20px rgba(223, 37, 49, 0.3))"
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <img 
                  src="/logos/Asset 2fair padel.png" 
                  alt="FairPadel" 
                  className="h-24 w-auto lg:h-32"
                />
                {/* Glow effect behind logo */}
                <div className="absolute inset-0 -z-10 blur-3xl bg-primary/30 rounded-full scale-150" />
              </motion.div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-primary text-sm font-medium">Bienvenido a la experiencia definitiva del pádel</span>
            </motion.div>

            {/* Headline - Bienvenida a la marca */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="heading-xl mb-6"
            >
              <span className="text-gradient">FairPadel</span>
              <br />
              <span className="text-white text-3xl sm:text-4xl lg:text-5xl font-semibold">
                La plataforma #1 de pádel en Paraguay
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="text-body text-lg mb-10 max-w-xl mx-auto lg:mx-0"
            >
              Únete a miles de jugadores y organizadores que ya viven el pádel 
              de forma profesional. Tu torneo, tu comunidad, tu pasión. 
              Todo en un solo lugar.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12"
            >
              <motion.a
                href="/register"
                className="btn-primary inline-flex items-center justify-center gap-2 text-lg group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Empezar Ahora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.button
                className="btn-secondary inline-flex items-center justify-center gap-2 text-lg group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Play className="w-5 h-5" />
                Ver Cómo Funciona
              </motion.button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-500"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-red-600 border-2 border-dark flex items-center justify-center text-xs font-bold text-white"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>+500 organizadores confían en FairPadel</span>
            </motion.div>
          </div>

          {/* Right Column - Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative hidden lg:block"
          >
            {/* Main Card */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 glass rounded-3xl p-8 glow-primary"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img 
                    src="/logos/Asset 2fair padel.png" 
                    alt="FairPadel" 
                    className="h-8 w-auto"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white">Copa Primavera</h3>
                    <p className="text-gray-400 text-sm">24 equipos inscritos</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                  EN CURSO
                </span>
              </div>
              
              {/* Bracket Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-dark-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">Pareja A</span>
                      <span className="text-primary font-bold">6</span>
                    </div>
                  </div>
                  <div className="text-gray-500 text-xs">VS</div>
                  <div className="flex-1 bg-dark-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">Pareja B</span>
                      <span className="text-gray-500 font-bold">4</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-dark-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">Pareja C</span>
                      <span className="text-primary font-bold">7</span>
                    </div>
                  </div>
                  <div className="text-gray-500 text-xs">VS</div>
                  <div className="flex-1 bg-dark-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">Pareja D</span>
                      <span className="text-gray-500 font-bold">5</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Progreso del torneo</span>
                  <span>75%</span>
                </div>
                <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '75%' }}
                    transition={{ duration: 1.5, delay: 1.2 }}
                    className="h-full bg-gradient-to-r from-primary to-red-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>

            {/* Floating Cards */}
            <motion.div
              animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -top-4 -right-4 glass rounded-2xl p-4 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">¡Ganador!</p>
                  <p className="text-gray-400 text-xs">Pareja A avanza</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -10, 0], x: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-4 -left-4 glass rounded-2xl p-4 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">+12 inscritos</p>
                  <p className="text-gray-400 text-xs">Esta semana</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 + index * 0.1 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <stat.icon className="w-5 h-5 text-primary" />
                <span className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
