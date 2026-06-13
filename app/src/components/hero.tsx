interface IProps {
  line: string;
  anim: string;
}

const Hero = (props: IProps) => {
  const { line, anim } = props;
  return <div className={`sprite hero hero-${line} hero-${anim}`} aria-label="hero" />;
};

export default Hero;
