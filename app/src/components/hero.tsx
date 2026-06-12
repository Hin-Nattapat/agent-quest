import type { ActivityState } from "../activity";

interface IProps {
  line: string;
  activity: ActivityState;
}

const Hero = (props: IProps) => {
  const { line, activity } = props;
  return (
    <div className={`sprite hero hero-${line} hero-${activity}`} aria-label="hero" />
  );
};

export default Hero;
