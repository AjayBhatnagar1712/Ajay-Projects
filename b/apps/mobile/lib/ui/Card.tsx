import type { ReactNode } from "react";
import { Card as PaperCard } from "react-native-paper";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onPress?: () => void;
};

export function Card({ title, subtitle, children, onPress }: Props) {
  return (
    <PaperCard mode="elevated" onPress={onPress}>
      {title ? <PaperCard.Title title={title} subtitle={subtitle} /> : null}
      <PaperCard.Content>{children}</PaperCard.Content>
    </PaperCard>
  );
}
