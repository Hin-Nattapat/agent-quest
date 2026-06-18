interface IProps {
  hits: number[];
}

// Hand-made impact flashes at the hero anchor when a mob's counter-attack connects (no art).
const HeroHits = (props: IProps) => {
  const { hits } = props;
  return (
    <div className="hero-hits" aria-hidden="true">
      {hits.map(id => (
        <span key={id} className="hero-hit" />
      ))}
    </div>
  );
};

export default HeroHits;
