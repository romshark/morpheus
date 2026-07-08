import type {
  DetailedHTMLProps,
  HTMLAttributes,
} from "react";

type NeoElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "neo-card": NeoElementProps;
      "neo-layout": NeoElementProps & {
        row?: boolean;
        column?: boolean;
        inline?: boolean;
        wrap?: boolean;
        gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
        "align-items"?: string;
        "justify-content"?: string;
      };
      "neo-select": NeoElementProps & {
        value?: string;
        placeholder?: string;
      };
      "neo-option": NeoElementProps & {
        value?: string;
      };
      "neo-color-field": NeoElementProps & {
        value?: string;
        hue?: number | string;
      };
      "neo-textinput": NeoElementProps & {
        value?: string;
        mask?: string;
        prefix?: string;
      };
    }
  }
}