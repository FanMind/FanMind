import styles from "./validation.module.css";
export default function Layout(props:{children:React.ReactNode}){return <div className={styles.scope}>{props.children}</div>}
