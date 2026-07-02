import { useEffect, useState, type ReactNode } from "react";

export const PROFILE_ICON_IMAGE_MAX_BYTES = 2_000_000;
export const PROFILE_ICON_DATA_URL_MAX_LENGTH = 512_000;

export const isProfileIconImage = (icon: string): boolean =>
  icon.startsWith("data:image/");

export const takeProfileEmoji = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(trimmed)][0]?.segment ?? trimmed.slice(0, 4);
  }
  return trimmed.slice(0, 4);
};

export const normalizeProfileIcon = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isProfileIconImage(trimmed)) {
    return trimmed.length <= PROFILE_ICON_DATA_URL_MAX_LENGTH ? trimmed : "";
  }
  return takeProfileEmoji(trimmed);
};

export const readProfileIconImage = (file: File | undefined): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nenhum arquivo selecionado."));
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione um arquivo de imagem."));
      return;
    }
    if (file.size > PROFILE_ICON_IMAGE_MAX_BYTES) {
      reject(new Error("A imagem deve ter no maximo 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Nao foi possivel ler a imagem."));
        return;
      }
      if (reader.result.length > PROFILE_ICON_DATA_URL_MAX_LENGTH) {
        reject(new Error("A imagem e grande demais para salvar no perfil."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });

type ProfileIconProps = {
  icon: string;
  textClassName?: string;
  imageClassName?: string;
  fallback?: ReactNode;
};

export function ProfileIcon({
  icon,
  textClassName,
  imageClassName = "profile-icon-image",
  fallback = null,
}: ProfileIconProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [icon]);

  if (!isProfileIconImage(icon)) {
    if (icon) {
      return <span className={textClassName}>{icon}</span>;
    }
    return <>{fallback}</>;
  }

  if (!imageFailed) {
    return (
      <img
        src={icon}
        alt=""
        className={imageClassName}
        draggable={false}
        onError={() => setImageFailed(true)}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth === 0 || naturalHeight === 0) {
            setImageFailed(true);
          }
        }}
      />
    );
  }

  return <>{fallback}</>;
}
