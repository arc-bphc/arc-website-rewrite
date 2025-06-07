import "./GlitchText.css";

const GlitchText = ({
	children,
	speed = 1,
	enableShadows = true,
	enableOnHover = true,
	className = "",
	fontSize = 1
}) => {
	const inlineStyles = {
		"--after-duration": `${speed * 3}s`,
		"--before-duration": `${speed * 2}s`,
		"--after-shadow": enableShadows ? "-5px 0 red" : "none",
		"--before-shadow": enableShadows ? "5px 0 cyan" : "none",
		"font-size": fontSize+"rem"
	};

	const hoverClass = enableOnHover ? "enable-on-hover" : "";

	return (
		<div
			className={`glitch ${hoverClass} ${className}`}
			style={inlineStyles}
			data-text={"Coming soon..."}
		>
			{children}
		</div>
	);
};

export default GlitchText;
