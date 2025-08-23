import type { ReactNode } from "react";
import Marquee from "react-fast-marquee";
import type { MarqueeProps } from "react-fast-marquee";

export default function Banner({
	children,
	...props
}: MarqueeProps & { children?: ReactNode }) {
	return <Marquee {...props}>{children}</Marquee>;
}
