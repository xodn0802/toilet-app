"use client";

type Props = {
  /** 1~5. 입력 모드에서 0 은 "아직 안 고름". */
  value: number;
  /** 넘기면 입력 모드가 된다. 없으면 읽기 전용. */
  onChange?: (value: number) => void;
  size?: "sm" | "lg";
  /** 입력 모드에서 스크린리더가 읽을 그룹 이름. */
  label?: string;
};

const SIZE_CLASS = { sm: "text-sm", lg: "text-3xl" } as const;

const FILLED = "text-star";
const EMPTY = "text-star-empty";

export default function StarRating({
  value,
  onChange,
  size = "sm",
  label = "청결도",
}: Props) {
  // 읽기 전용은 버튼 5개를 만들 이유가 없다. 탭 이동만 방해한다.
  if (!onChange) {
    return (
      <span
        className={`${SIZE_CLASS[size]} leading-none`}
        aria-label={`${label} ${value}점`}
      >
        <span className={FILLED}>{"★★★★★".slice(0, value)}</span>
        <span className={EMPTY}>{"★★★★★".slice(value)}</span>
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          aria-label={`${score}점`}
          onClick={() => onChange(score)}
          className={`rounded-lg leading-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            SIZE_CLASS[size]
          } ${score <= value ? FILLED : EMPTY}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
