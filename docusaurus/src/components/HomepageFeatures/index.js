import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Fireteam',
    img: require('@site/static/img/fireteam.png').default,
    description: (
      <>
        Fireteam characters, specializations, perks and weapons statistics.
      </>
    ),
    link: '/fireteam',
  },
  {
    title: 'Predator',
    img: require('@site/static/img/predator.png').default,
    description: (
      <>
        Predator characters, specializations, perks and weapons statistics,
        plus an effective health and damage calculator.
      </>
    ),
    link: '/predator',
  },
  {
    title: 'Nerds',
    img: require('@site/static/img/nerd.png').default,
    description: (
      <>
        Under-the-hood mechanics: damage formulas, armor, body parts
        and NPC statistics.
      </>
    ),
    link: '/nerds',
  },
];

function Feature({img, title, description, link}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <a href={link}>
          <img src={img} />
        </a>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3"><a href={link}>{title}</a></Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
