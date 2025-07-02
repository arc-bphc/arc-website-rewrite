import { motion } from "framer-motion"

export default function TextReveal({ text, className }: { text: string, className: string }) {
  const words = text.split(" ");

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
            delay: i * 0.05,
          }}
          viewport={{ amount: .1, once: true }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}
