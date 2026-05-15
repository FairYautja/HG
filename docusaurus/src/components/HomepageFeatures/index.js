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
        Docusaurus lets you focus on your docs, and we&apos;ll do the chores. Go
        ahead and move your docs into the <code>docs</code> directory.
      </>
    ),
    link: '/predator',
  },
  {
    title: 'Nerds',
    img: require('@site/static/img/nerd.png').default,
    description: (
      <>
        Extend or customize your website layout by reusing React. Docusaurus can
        be extended while reusing the same header and footer.
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
