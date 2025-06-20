import ASCIIText from "./TextAnimations/ASCIIText/ASCIIText"
import {motion, useScroll, useTransform} from "framer-motion"

import "../styles/globals.css"



export default function AnimatedHero(){
	const {scrollY} = useScroll()
	const scale = useTransform(scrollY, [0,500], [1, 5])
	const opacity = useTransform(scrollY, [0,500], [1, 0])
	const y = useTransform(scrollY, [0,500], [0, -100])


	return(
		<motion.div className="canvas-container relative w-full h-[20rem] m-0 mt-[calc(50svh-14rem)] md:m-0 md:h-[calc(100vh_-_14rem)] overflow-hidden" style={{scale, opacity, y}}>
			<ASCIIText
				text='ARC'
				enableWaves={false}
				asciiFontSize={8}
				textColor={"#ccff00"}
			/>
		</motion.div>
	)
}

