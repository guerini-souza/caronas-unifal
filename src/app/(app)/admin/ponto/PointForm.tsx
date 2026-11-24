"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:) e foto do Storage. */
import { useActionState, useEffect, useState } from "react";
import { savePoint } from "@/app/actions/admin";
import { AppButton, buttonClasses } from "@/components/AppButton";
import { Field } from "@/components/Field";
import { IconPin } from "@/components/icons";
import { ErrorMessage } from "@/components/States";
import { compressImage } from "@/lib/compress-image";
import { formatCoordinates, mapsUrl, parseCoordinates } from "@/lib/geo";
import type { AdminPoint } from "@/lib/types";

type Props = { neighborhoodId: string; point: AdminPoint | null };

export function PointForm({ neighborhoodId, point }: Props) {
  const [state, action, pending] = useActionState(savePoint, undefined);
  const fe = state?.fieldErrors ?? {};

  // Campos controlados: o React limpa campos não controlados após cada envio, e um erro
  // de validação apagaria o que foi digitado.
  const [name, setName] = useState(point?.name ?? "");
  const [address, setAddress] = useState(point?.address ?? "");
  const [description, setDescription] = useState(point?.description ?? "");
  const [active, setActive] = useState(point?.active ?? true);

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(point?.image_url ?? null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [location, setLocation] = useState(
    point?.latitude != null && point.longitude != null ? formatCoordinates(point.latitude, point.longitude) : "",
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const coords = parseCoordinates(location);

  // Libera a prévia local ao trocar de foto ou sair da tela.
  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const blob = await compressImage(file);
      setPhoto(blob);
      setPhotoRemoved(false);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setPhotoError("Não foi possível usar essa foto. Tente outra.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function dropPhoto() {
    setPhoto(null);
    setPhotoRemoved(true);
    setPreview(null);
  }

  function fillMyLocation() {
    if (!("geolocation" in navigator)) return setLocError("Este aparelho não informa a localização.");
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(formatCoordinates(pos.coords.latitude, pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setLocError("Não deu para pegar a localização. Permita o acesso à localização e tente de novo.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // A foto vai já reduzida; o arquivo original do celular não é enviado.
  function submit(formData: FormData) {
    if (photo) formData.set("photo", new File([photo], "foto.jpg", { type: photo.type }));
    if (photoRemoved) formData.set("remove_photo", "1");
    action(formData);
  }

  return (
    <form action={submit} className="space-y-6" noValidate>
      {point ? <input type="hidden" name="id" value={point.id} /> : <input type="hidden" name="neighborhood_id" value={neighborhoodId} />}

      <Field label="Nome do ponto" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={fe.name} required />

      <section className="space-y-3">
        <p className="text-base font-bold">Foto</p>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-pontos-soft">
          {preview ? (
            <img src={preview} alt="Foto do ponto" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-pontos-dark">
              <IconPin className="h-10 w-10" />
              <span className="font-semibold">{photoBusy ? "Preparando foto..." : "Sem foto"}</span>
            </div>
          )}
        </div>
        <label className={buttonClasses("pontos", "lg", "cursor-pointer")}>
          <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} disabled={photoBusy || pending} />
          {preview ? "TROCAR FOTO" : "TIRAR OU ESCOLHER FOTO"}
        </label>
        {preview ? (
          <AppButton variant="ghost" size="md" onClick={dropPhoto} disabled={pending}>
            Remover foto
          </AppButton>
        ) : null}
        <ErrorMessage>{photoError ?? fe.photo}</ErrorMessage>
      </section>

      <Field
        label="Endereço"
        name="address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Ex.: Rua Tal, 123 — em frente à padaria"
        maxLength={200}
        error={fe.address}
      />

      <div className="space-y-2">
        <label htmlFor="description" className="block text-base font-bold">
          Observações
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Como achar o ponto, onde esperar, dicas para bixetes..."
          aria-invalid={fe.description ? true : undefined}
          className={`block w-full rounded-2xl border-2 bg-surface px-4 py-3 text-lg outline-none transition focus:border-pegar ${
            fe.description ? "border-danger" : "border-border"
          }`}
        />
        {fe.description ? <p className="text-sm font-semibold text-danger">{fe.description}</p> : null}
      </div>

      <section className="space-y-3">
        <Field
          label="Localização no mapa"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          inputMode="text"
          placeholder="-21.7876, -46.5613"
          hint="Estando no ponto, toque no botão abaixo. Ou, no Google Maps, segure o dedo no local e cole aqui os números que aparecem."
          error={fe.location}
        />
        <AppButton variant="ghost" size="md" onClick={fillMyLocation} disabled={locating || pending}>
          {locating ? "Pegando localização..." : "USAR MINHA LOCALIZAÇÃO"}
        </AppButton>
        {coords ? (
          <a
            href={mapsUrl(coords.lat, coords.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-bold text-pontos underline underline-offset-4"
          >
            Conferir no mapa
          </a>
        ) : null}
        <ErrorMessage>{locError}</ErrorMessage>
      </section>

      {point ? (
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-6 w-6 accent-pontos" />
          <span className="text-lg font-semibold">Mostrar este ponto no app</span>
        </label>
      ) : null}

      <ErrorMessage>{state?.error}</ErrorMessage>
      <button type="submit" disabled={pending || photoBusy} aria-busy={pending} className={buttonClasses("pontos", "lg")}>
        {pending ? "Salvando..." : "SALVAR PONTO"}
      </button>
      <AppButton href={`/admin/bairro/${neighborhoodId}`} variant="ghost" size="md">
        Cancelar
      </AppButton>
    </form>
  );
}
