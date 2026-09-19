--
-- PostgreSQL database dump
--

\restrict zyZ6llTgUP85TZDraX475l72LysfZ95pGiieQtoxjjFqlTM4oUO3GLlBy90No0f

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_bookmarks_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_bookmarks_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: enum_bookmarks_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_bookmarks_status AS ENUM (
    'active',
    'read',
    'completed',
    'archived',
    'cancelled'
);


--
-- Name: enum_bookmarks_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_bookmarks_type AS ENUM (
    'bookmark',
    'reminder'
);


--
-- Name: enum_periods_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_periods_status AS ENUM (
    'pending',
    'active',
    'completed',
    'cancelled'
);


--
-- Name: enum_sms_logs_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_sms_logs_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'cancelled'
);


--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_users_role AS ENUM (
    'super_admin',
    'admin',
    'sub_admin',
    'expert',
    'customer'
);


--
-- Name: enum_users_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_users_status AS ENUM (
    'active',
    'inactive',
    'pending',
    'blocked'
);


--
-- Name: calculate_hall_area(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_hall_area() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.length IS NOT NULL AND NEW.width IS NOT NULL THEN
        NEW.area = NEW.length * NEW.width;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_hall_physical_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_hall_physical_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value character varying(500) DEFAULT 'true'::character varying NOT NULL,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN app_settings.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.key IS 'کلید تنظیم (مثلاً auto_welcome_sms)';


--
-- Name: COLUMN app_settings.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.value IS 'مقدار تنظیم (برای boolean: ''true'' | ''false'')';


--
-- Name: COLUMN app_settings.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.updated_by IS 'آخرین کاربری که تنظیم را تغییر داده';


--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'bookmark'::character varying NOT NULL,
    customer_id integer NOT NULL,
    flock_id integer,
    week_number integer,
    flock_age_days integer,
    due_date timestamp with time zone,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    read_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by integer NOT NULL,
    assigned_to integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer,
    flock_period_id integer,
    hall_id integer,
    CONSTRAINT bookmarks_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text]))),
    CONSTRAINT bookmarks_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('read'::character varying)::text, ('completed'::character varying)::text, ('archived'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT bookmarks_type_check CHECK (((type)::text = ANY (ARRAY[('bookmark'::character varying)::text, ('reminder'::character varying)::text])))
);


--
-- Name: COLUMN bookmarks.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: COLUMN bookmarks.flock_period_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.flock_period_id IS 'شناسه گله/دوره پرورش (جدول flocks)';


--
-- Name: COLUMN bookmarks.hall_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookmarks.hall_id IS 'شناسه اختیاری جوجه‌ریزی/سالن داخل گله';


--
-- Name: bookmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookmarks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookmarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookmarks_id_seq OWNED BY public.bookmarks.id;


--
-- Name: breed_weight_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breed_weight_standards (
    id integer NOT NULL,
    breed_id integer NOT NULL,
    week_number integer NOT NULL,
    age_days integer NOT NULL,
    target_weight numeric(6,2) NOT NULL,
    min_weight numeric(6,2),
    max_weight numeric(6,2),
    source_type character varying(20) DEFAULT 'system'::character varying,
    source_description text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    standard_fcr numeric(6,3),
    standard_feed_intake numeric(10,2),
    CONSTRAINT valid_weight_range CHECK (((min_weight <= target_weight) AND (target_weight <= max_weight)))
);


--
-- Name: COLUMN breed_weight_standards.breed_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.breed_id IS '🔗 ارجاع به جدول chicken_breeds (نژاد)';


--
-- Name: COLUMN breed_weight_standards.week_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.week_number IS '📊 شماره هفته (۱ تا ۱۰)';


--
-- Name: COLUMN breed_weight_standards.age_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.age_days IS '📅 سن بر حسب روز';


--
-- Name: COLUMN breed_weight_standards.target_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.target_weight IS '🎯 وزن هدف (کیلوگرم)';


--
-- Name: COLUMN breed_weight_standards.min_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.min_weight IS '📉 حداقل وزن قابل قبول (کیلوگرم)';


--
-- Name: COLUMN breed_weight_standards.max_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.max_weight IS '📈 حداکثر وزن قابل قبول (کیلوگرم)';


--
-- Name: COLUMN breed_weight_standards.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.source_type IS '📌 منبع استاندارد: system, user, breed_company, custom';


--
-- Name: COLUMN breed_weight_standards.source_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.source_description IS '📝 توضیحات منبع';


--
-- Name: COLUMN breed_weight_standards.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.is_active IS '✅ فعال/غیرفعال';


--
-- Name: COLUMN breed_weight_standards.is_default; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.is_default IS '⭐ استاندارد پیش‌فرض';


--
-- Name: COLUMN breed_weight_standards.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.created_by IS '👤 کاربر ایجادکننده (ارجاع به users)';


--
-- Name: COLUMN breed_weight_standards.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.updated_by IS '👤 کاربر بروزرسانی‌کننده (ارجاع به users)';


--
-- Name: COLUMN breed_weight_standards.standard_fcr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.standard_fcr IS '🍗 ضریب تبدیل غذایی استاندارد (FCR) در این هفته';


--
-- Name: COLUMN breed_weight_standards.standard_feed_intake; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.breed_weight_standards.standard_feed_intake IS '🛒 مصرف خوراک استاندارد تجمعی تا این هفته (کیلوگرم - کل گله)';


--
-- Name: breed_weight_standards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.breed_weight_standards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: breed_weight_standards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.breed_weight_standards_id_seq OWNED BY public.breed_weight_standards.id;


--
-- Name: chick_placements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chick_placements (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    hall_id integer NOT NULL,
    placement_date date NOT NULL,
    flock_number integer NOT NULL,
    chick_source_id integer NOT NULL,
    breed_id integer NOT NULL,
    chick_age_on_arrival integer DEFAULT 1 NOT NULL,
    avg_initial_weight numeric(10,2),
    total_chicks_count integer NOT NULL,
    placement_density numeric(10,2),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    unit_id integer,
    flock_id integer
);


--
-- Name: TABLE chick_placements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chick_placements IS 'جداول مدیریت جوجه و گله';


--
-- Name: COLUMN chick_placements.chick_source_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.chick_source_id IS 'مبدا جوجه (ارجاع به دیکشنری chick_sources)';


--
-- Name: COLUMN chick_placements.breed_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.breed_id IS 'نژاد جوجه (ارجاع به دیکشنری chicken_breeds)';


--
-- Name: COLUMN chick_placements.chick_age_on_arrival; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.chick_age_on_arrival IS 'سن جوجه در بدو ورود (روز)';


--
-- Name: COLUMN chick_placements.avg_initial_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.avg_initial_weight IS 'میانگین وزن اولیه (گرم)';


--
-- Name: COLUMN chick_placements.total_chicks_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.total_chicks_count IS 'تعداد کل جوجه‌ها';


--
-- Name: COLUMN chick_placements.placement_density; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.placement_density IS 'تراکم جوجه‌ریزی';


--
-- Name: COLUMN chick_placements.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.is_active IS 'فعال بودن جوجه‌ریزی (فقط یک رکورد فعال برای هر سالن)';


--
-- Name: COLUMN chick_placements.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: COLUMN chick_placements.flock_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chick_placements.flock_id IS 'شناسه گله (دوره پرورش) که این جوجه‌ریزی سالن به آن تعلق دارد';


--
-- Name: chick_placements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chick_placements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chick_placements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chick_placements_id_seq OWNED BY public.chick_placements.id;


--
-- Name: chick_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chick_sources (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE chick_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chick_sources IS 'مبدا جوجه (مرغ مادر)

';


--
-- Name: chick_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chick_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chick_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chick_sources_id_seq OWNED BY public.chick_sources.id;


--
-- Name: chicken_breeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chicken_breeds (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    code character varying(50) NOT NULL
);


--
-- Name: TABLE chicken_breeds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chicken_breeds IS 'نژادهای جوجه

';


--
-- Name: chicken_breeds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chicken_breeds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chicken_breeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chicken_breeds_id_seq OWNED BY public.chicken_breeds.id;


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id integer NOT NULL,
    state_code text,
    state_name text,
    city_name text,
    latitude text,
    longitude text,
    latitude_deg text,
    longitude_deg text
);


--
-- Name: TABLE cities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cities IS 'شهرها و استان‌ها

';


--
-- Name: cities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cities_id_seq OWNED BY public.cities.id;


--
-- Name: cooling_system_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooling_system_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer,
    active boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE cooling_system_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cooling_system_types IS 'انواع سیستم های سرمایشی';


--
-- Name: cooling_system_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cooling_system_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cooling_system_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cooling_system_types_id_seq OWNED BY public.cooling_system_types.id;


--
-- Name: crop_test; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crop_test (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    hall_id integer NOT NULL,
    chick_placement_id integer,
    test_date date NOT NULL,
    week_number integer,
    sample_count integer,
    empty_crop_count integer,
    full_crop_count integer,
    abnormal_crop_count integer,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: TABLE crop_test; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crop_test IS 'تست چینه دان

';


--
-- Name: COLUMN crop_test.sample_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crop_test.sample_count IS 'تعداد نمونه‌ها';


--
-- Name: COLUMN crop_test.empty_crop_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crop_test.empty_crop_count IS 'تعداد چین‌دان خالی';


--
-- Name: COLUMN crop_test.full_crop_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crop_test.full_crop_count IS 'تعداد چین‌دان پر';


--
-- Name: COLUMN crop_test.abnormal_crop_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crop_test.abnormal_crop_count IS 'تعداد چین‌دان غیرعادی';


--
-- Name: crop_test_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crop_test_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crop_test_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crop_test_id_seq OWNED BY public.crop_test.id;


--
-- Name: customer_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_code_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_personal_information; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_personal_information (
    id integer NOT NULL,
    collection_name character varying(200),
    full_name character varying(200) NOT NULL,
    farm_name character varying(200),
    email character varying(100) DEFAULT 'temp@skb-crm.ir'::character varying,
    mobile_number character varying(20) NOT NULL,
    messaging_number character varying(20),
    date_of_birth date DEFAULT '2000-01-01'::date NOT NULL,
    experience_years character varying(50),
    education_level character varying(20),
    sales_department character varying(100),
    gender character varying(10),
    province character varying(50),
    county character varying(50),
    postal_code character varying(20),
    farm_address text,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    created_by integer,
    updated_at timestamp with time zone NOT NULL,
    updated_by integer,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    skb_how_know character varying(100),
    customer_code integer NOT NULL,
    national_code character varying(10),
    customer_type_id integer
);


--
-- Name: TABLE customer_personal_information; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_personal_information IS 'اطلاعات شخصی مشتریان

';


--
-- Name: COLUMN customer_personal_information.customer_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_personal_information.customer_code IS 'کد پایدار مشتری (کسب‌وکاری) - از سکوئنس جداگانه و هرگز بازاستفاده نمی‌شود';


--
-- Name: COLUMN customer_personal_information.national_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_personal_information.national_code IS 'کد ملی ۱۰ رقمی مشتری (اختیاری)';


--
-- Name: COLUMN customer_personal_information.customer_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_personal_information.customer_type_id IS 'نوع مشتری (کلید خارجی به customer_types)';


--
-- Name: customer_personal_information_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_personal_information_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_personal_information_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_personal_information_id_seq OWNED BY public.customer_personal_information.id;


--
-- Name: customer_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_types_id_seq OWNED BY public.customer_types.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    title character varying(100) NOT NULL,
    code character varying(20),
    parent_id integer,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE departments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.departments IS 'دپارتمان‌ها

';


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: diseases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diseases (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    treatment text,
    category character varying(50),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true
);


--
-- Name: TABLE diseases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.diseases IS 'بیماری‌ها';


--
-- Name: diseases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diseases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diseases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diseases_id_seq OWNED BY public.diseases.id;


--
-- Name: education_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.education_levels (
    id integer NOT NULL,
    title character varying(100) NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE education_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.education_levels IS 'سطح تحصیلات

';


--
-- Name: education_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.education_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: education_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.education_levels_id_seq OWNED BY public.education_levels.id;


--
-- Name: feed_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    feed_stage character varying(50),
    protein_percentage numeric(5,2),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true
);


--
-- Name: feed_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_types_id_seq OWNED BY public.feed_types.id;


--
-- Name: feeder_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feeder_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE feeder_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feeder_types IS 'جدول انواع دانخوری
';


--
-- Name: feeder_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feeder_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feeder_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feeder_types_id_seq OWNED BY public.feeder_types.id;


--
-- Name: flock_completion_halls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flock_completion_halls (
    id integer NOT NULL,
    flock_completion_id integer NOT NULL,
    flock_id integer,
    chick_placement_id integer NOT NULL,
    hall_id integer NOT NULL,
    customer_id integer NOT NULL,
    unit_id integer,
    initial_chicks_count integer,
    final_chicks_count integer,
    initial_avg_weight numeric(10,4),
    slaughter_age_days integer,
    final_week_number integer,
    total_feed_intake numeric(16,2),
    final_avg_weight numeric(10,2),
    total_mortality integer,
    mortality_rate numeric(8,2),
    system_fcr numeric(10,3),
    system_last_weight numeric(10,2),
    system_total_feed numeric(12,2),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sent_to_slaughter_count integer,
    live_weight_kg numeric(18,2),
    declared_feed_intake numeric(12,2)
);


--
-- Name: COLUMN flock_completion_halls.flock_completion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.flock_completion_id IS 'شناسه رکورد پایان دوره گله';


--
-- Name: COLUMN flock_completion_halls.chick_placement_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.chick_placement_id IS 'جوجه‌ریزی همان سالن';


--
-- Name: COLUMN flock_completion_halls.hall_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.hall_id IS 'سالن';


--
-- Name: COLUMN flock_completion_halls.sent_to_slaughter_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.sent_to_slaughter_count IS 'تعداد ارسالی به کشتارگاه (اعلامی مرغدار، اختیاری)';


--
-- Name: COLUMN flock_completion_halls.live_weight_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.live_weight_kg IS 'وزن کل زنده این سالن در کشتارگاه (اختیاری)';


--
-- Name: COLUMN flock_completion_halls.declared_feed_intake; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completion_halls.declared_feed_intake IS 'خوراک مصرفی اعلامی مرغدار برای این سالن (اختیاری)';


--
-- Name: flock_completion_halls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flock_completion_halls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flock_completion_halls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flock_completion_halls_id_seq OWNED BY public.flock_completion_halls.id;


--
-- Name: flock_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flock_completions (
    id integer NOT NULL,
    chick_placement_id integer NOT NULL,
    customer_id integer NOT NULL,
    hall_id integer,
    completed_by integer,
    completion_date date NOT NULL,
    completion_type character varying(50) DEFAULT 'completed'::character varying,
    confirmed_by_customer boolean DEFAULT false,
    initial_chicks_count integer,
    final_chicks_count integer,
    initial_avg_weight numeric(10,4) DEFAULT 0.04,
    slaughter_age_days integer,
    slaughter_date date,
    slaughterhouse_name character varying(100),
    transport_mortality integer DEFAULT 0,
    total_sent integer,
    total_live_weight numeric(12,2),
    avg_live_weight numeric(12,3),
    final_week_number integer NOT NULL,
    total_feed_intake numeric(16,2),
    final_avg_weight numeric(10,2),
    total_mortality integer,
    mortality_rate numeric(8,2),
    farmer_fcr numeric(10,3),
    farmer_total_meat numeric(12,2),
    farmer_total_feed numeric(12,2),
    farmer_total_weight numeric(12,2),
    system_last_weight numeric(10,2),
    system_total_feed numeric(16,2),
    system_fcr numeric(10,3),
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer,
    flock_id integer NOT NULL,
    price_per_kg numeric(18,2),
    income_total numeric(20,2),
    chick_cost numeric(20,2),
    feed_cost numeric(20,2),
    medication_cost numeric(20,2),
    fuel_cost numeric(20,2),
    labor_cost numeric(20,2),
    other_cost numeric(20,2),
    total_cost numeric(20,2),
    net_profit numeric(20,2),
    profit_percent numeric(8,2),
    carcass_weight_kg numeric(18,2),
    carcass_yield_percent numeric(8,2),
    feed_basis character varying(20) DEFAULT 'system'::character varying NOT NULL,
    epi numeric(10,2),
    adg_grams numeric(10,2),
    total_weight_gain_kg numeric(18,2),
    survival_percent numeric(8,2),
    final_fcr numeric(10,3),
    system_epi numeric(10,2),
    system_adg_grams numeric(10,2),
    system_weight_gain_kg numeric(18,2),
    system_survival_percent numeric(8,2),
    farmer_epi numeric(10,2),
    farmer_adg_grams numeric(10,2),
    farmer_weight_gain_kg numeric(18,2),
    farmer_survival_percent numeric(8,2),
    slaughter_end_date date,
    slaughter_age_end_days integer,
    slaughter_age_method character varying(20),
    slaughter_shipments json
);


--
-- Name: TABLE flock_completions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.flock_completions IS 'جدول اطلاعات پایان دوره پرورش گله';


--
-- Name: COLUMN flock_completions.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.id IS '🆔 شناسه یکتا (Primary Key)';


--
-- Name: COLUMN flock_completions.chick_placement_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.chick_placement_id IS '🆔 جوجه‌ریزی نماینده گله (اولین سالن) — برای سازگاری با نمایش‌های قدیمی';


--
-- Name: COLUMN flock_completions.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.customer_id IS '🆔 شناسه مشتری (ارجاع به جدول customer_personal_information)';


--
-- Name: COLUMN flock_completions.hall_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.hall_id IS '🆔 سالن نماینده گله (اولین سالن) — ریز هر سالن در flock_completion_halls';


--
-- Name: COLUMN flock_completions.completed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.completed_by IS '🆔 کاربر تکمیل‌کننده (ارجاع به جدول users)';


--
-- Name: COLUMN flock_completions.completion_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.completion_date IS '📋 تاریخ تکمیل اطلاعات در سیستم';


--
-- Name: COLUMN flock_completions.completion_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.completion_type IS '📋 نوع پایان دوره: completed(تکمیل), culled(حذف), emergency(اضطراری)';


--
-- Name: COLUMN flock_completions.confirmed_by_customer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.confirmed_by_customer IS '📋 تأیید صحت اطلاعات توسط مرغدار (TRUE/FALSE)';


--
-- Name: COLUMN flock_completions.initial_chicks_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.initial_chicks_count IS '🐣 تعداد جوجه‌ریزی اولیه (قطعه)';


--
-- Name: COLUMN flock_completions.final_chicks_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.final_chicks_count IS '🐣 تعداد جوجه مانده تا آخرین هفته (قطعه)';


--
-- Name: COLUMN flock_completions.initial_avg_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.initial_avg_weight IS '🐣 وزن اولیه هر جوجه در جوجه‌ریزی (کیلوگرم) - معمولاً ۰.۰۴۰ (۴۰ گرم)';


--
-- Name: COLUMN flock_completions.slaughter_age_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_age_days IS '📅 سن کشتار (روز) — سن در تاریخ شروع کشتار';


--
-- Name: COLUMN flock_completions.slaughter_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_date IS '🏭 تاریخ شروع کشتار در کشتارگاه';


--
-- Name: COLUMN flock_completions.slaughterhouse_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughterhouse_name IS '🏭 نام کشتارگاه';


--
-- Name: COLUMN flock_completions.transport_mortality; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.transport_mortality IS '🏭 تلفات حین حمل و نقل به کشتارگاه';


--
-- Name: COLUMN flock_completions.total_sent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_sent IS '🏭 تعداد قطعه ارسالی به کشتارگاه';


--
-- Name: COLUMN flock_completions.total_live_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_live_weight IS '🏭 وزن کل زنده گله در کشتارگاه (کیلوگرم)';


--
-- Name: COLUMN flock_completions.avg_live_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.avg_live_weight IS '🏭 میانگین وزن زنده هر قطعه (کیلوگرم) - از کشتارگاه';


--
-- Name: COLUMN flock_completions.final_week_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.final_week_number IS '📊 شماره هفته آخر پرورش';


--
-- Name: COLUMN flock_completions.total_feed_intake; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_feed_intake IS '📊 کل خوراک مصرفی (از داده‌های سیستم)';


--
-- Name: COLUMN flock_completions.final_avg_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.final_avg_weight IS '📊 میانگین وزن نهایی هر قطعه (کیلوگرم)';


--
-- Name: COLUMN flock_completions.total_mortality; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_mortality IS '📊 تلفات کل (تلفات سیستم + تلفات حمل)';


--
-- Name: COLUMN flock_completions.mortality_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.mortality_rate IS '📊 درصد تلفات: (تلفات کل / تعداد اولیه) × ۱۰۰';


--
-- Name: COLUMN flock_completions.farmer_fcr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_fcr IS '👨‍🌾 ضریب تبدیل نهایی اعلامی مرغدار';


--
-- Name: COLUMN flock_completions.farmer_total_meat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_total_meat IS '👨‍🌾 کل گوشت بدست آمده اعلامی مرغدار (کیلوگرم)';


--
-- Name: COLUMN flock_completions.farmer_total_feed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_total_feed IS '👨‍🌾 کل خوراک مصرفی نهایی اعلامی مرغدار (کیلوگرم)';


--
-- Name: COLUMN flock_completions.farmer_total_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_total_weight IS '👨‍🌾 وزن کل اعلامی از سمت مرغدار (کیلوگرم)';


--
-- Name: COLUMN flock_completions.system_last_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_last_weight IS '💻 آخرین وزن گله در آخرین هفته (کیلوگرم) - محاسبه‌شده از داده‌های هفتگی';


--
-- Name: COLUMN flock_completions.system_total_feed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_total_feed IS '💻 مجموع مصرفی خوراک در طول دوره (کیلوگرم) - جمع داده‌های هفتگی';


--
-- Name: COLUMN flock_completions.system_fcr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_fcr IS '💻 ضریب تبدیل سیستمی: (کل خوراک / افزایش وزن کل) - بر اساس داده‌های ثبت شده';


--
-- Name: COLUMN flock_completions.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.notes IS '📝 توضیحات تکمیلی';


--
-- Name: COLUMN flock_completions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.created_at IS '📝 زمان ایجاد رکورد';


--
-- Name: COLUMN flock_completions.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.updated_at IS '📝 زمان آخرین بروزرسانی';


--
-- Name: COLUMN flock_completions.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.unit_id IS '🆔 شناسه واحد مرغداری (ارجاع به جدول units)';


--
-- Name: COLUMN flock_completions.flock_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.flock_id IS '🆔 شناسه گله/دوره پرورش (ارجاع به جدول flocks) — یک پایان دوره per گله';


--
-- Name: COLUMN flock_completions.price_per_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.price_per_kg IS '💰 قیمت هر کیلوگرم وزن زنده فروش به کشتارگاه';


--
-- Name: COLUMN flock_completions.income_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.income_total IS '💰 درآمد کل = وزن کل زنده × قیمت هر کیلو';


--
-- Name: COLUMN flock_completions.chick_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.chick_cost IS '💰 هزینه جوجه (قیمت هر جوجه × تعداد اولیه)';


--
-- Name: COLUMN flock_completions.feed_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.feed_cost IS '💰 هزینه خوراک (کل خوراک × قیمت هر کیلو)';


--
-- Name: COLUMN flock_completions.medication_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.medication_cost IS '💰 هزینه دارو و واکسن';


--
-- Name: COLUMN flock_completions.fuel_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.fuel_cost IS '💰 هزینه سوخت (گاز، برق، آب)';


--
-- Name: COLUMN flock_completions.labor_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.labor_cost IS '💰 هزینه نیروی انسانی';


--
-- Name: COLUMN flock_completions.other_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.other_cost IS '💰 سایر هزینه‌ها (بستر، حمل، تعمیرات)';


--
-- Name: COLUMN flock_completions.total_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_cost IS '💰 جمع کل هزینه‌ها';


--
-- Name: COLUMN flock_completions.net_profit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.net_profit IS '💰 سود خالص = درآمد کل − جمع کل هزینه‌ها';


--
-- Name: COLUMN flock_completions.profit_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.profit_percent IS '💰 درصد سود = (سود خالص ÷ درآمد کل) × ۱۰۰';


--
-- Name: COLUMN flock_completions.carcass_weight_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.carcass_weight_kg IS '🍗 وزن لاشه بعد از پرکنی (کیلوگرم)';


--
-- Name: COLUMN flock_completions.carcass_yield_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.carcass_yield_percent IS '🍗 درصد راندمان لاشه = (وزن لاشه ÷ وزن زنده) × ۱۰۰';


--
-- Name: COLUMN flock_completions.feed_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.feed_basis IS '📈 مبنای محاسبه خوراک در FCR نهایی: system | declared';


--
-- Name: COLUMN flock_completions.epi; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.epi IS '📈 شاخص اروپایی EPI';


--
-- Name: COLUMN flock_completions.adg_grams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.adg_grams IS '📈 نرخ رشد روزانه (گرم در روز)';


--
-- Name: COLUMN flock_completions.total_weight_gain_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.total_weight_gain_kg IS '📈 افزایش وزن کل گله (کیلوگرم)';


--
-- Name: COLUMN flock_completions.survival_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.survival_percent IS '📈 درصد زنده‌مانی گله';


--
-- Name: COLUMN flock_completions.final_fcr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.final_fcr IS '📈 ضریب تبدیل نهایی (بر اساس مبنای خوراک انتخابی)';


--
-- Name: COLUMN flock_completions.system_epi; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_epi IS 'EPI بر اساس داده‌های سیستم';


--
-- Name: COLUMN flock_completions.system_adg_grams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_adg_grams IS 'ADG (گرم/روز) بر اساس داده‌های سیستم';


--
-- Name: COLUMN flock_completions.system_weight_gain_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_weight_gain_kg IS 'افزایش وزن کل بر اساس داده‌های سیستم';


--
-- Name: COLUMN flock_completions.system_survival_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.system_survival_percent IS 'درصد زنده‌مانی بر اساس داده‌های سیستم';


--
-- Name: COLUMN flock_completions.farmer_epi; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_epi IS 'EPI بر اساس اطلاعات اعلامی مرغدار';


--
-- Name: COLUMN flock_completions.farmer_adg_grams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_adg_grams IS 'ADG (گرم/روز) بر اساس اطلاعات اعلامی مرغدار';


--
-- Name: COLUMN flock_completions.farmer_weight_gain_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_weight_gain_kg IS 'افزایش وزن کل بر اساس اطلاعات اعلامی مرغدار';


--
-- Name: COLUMN flock_completions.farmer_survival_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.farmer_survival_percent IS 'درصد زنده‌مانی بر اساس اطلاعات اعلامی مرغدار';


--
-- Name: COLUMN flock_completions.slaughter_end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_end_date IS '🏭 تاریخ پایان کشتار (برای گله‌های بزرگ که فرایند کشتار چند روز طول می‌کشد)';


--
-- Name: COLUMN flock_completions.slaughter_age_end_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_age_end_days IS '📅 سن پایان کشتار (روز) — وقتی کشتار چند روز طول بکشد';


--
-- Name: COLUMN flock_completions.slaughter_age_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_age_method IS '📅 روش ثبت سن کشتار نهایی: range(بازه تاریخی) | direct(ورود مستقیم سن) | weighted(میانگین وزنی ارسال‌های چندمرحله‌ای)';


--
-- Name: COLUMN flock_completions.slaughter_shipments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flock_completions.slaughter_shipments IS '📅 جزئیات ارسال‌های چندمرحله‌ای به کشتارگاه در روش weighted: [{age_days, quantity, date}]';


--
-- Name: flock_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flock_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flock_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flock_completions_id_seq OWNED BY public.flock_completions.id;


--
-- Name: flocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flocks (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    unit_id integer NOT NULL,
    flock_number integer NOT NULL,
    placement_date date NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    ended_at date,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN flocks.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flocks.unit_id IS 'واحد مرغداری (یک گله زیر یک واحد)';


--
-- Name: COLUMN flocks.flock_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flocks.flock_number IS 'شماره گله — یکتا به ازای هر (مشتری + واحد)';


--
-- Name: COLUMN flocks.placement_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flocks.placement_date IS 'تاریخ شروع گله (جوجه‌ریزی)';


--
-- Name: COLUMN flocks.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flocks.status IS 'وضعیت: pending | active | completed | cancelled';


--
-- Name: COLUMN flocks.ended_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.flocks.ended_at IS 'تاریخ پایان گله';


--
-- Name: flocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flocks_id_seq OWNED BY public.flocks.id;


--
-- Name: floor_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.floor_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE floor_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.floor_types IS 'انواع جنس کف سالن';


--
-- Name: floor_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.floor_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: floor_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.floor_types_id_seq OWNED BY public.floor_types.id;


--
-- Name: hall_hygiene; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_hygiene (
    id integer NOT NULL,
    hall_id integer NOT NULL,
    customer_id integer NOT NULL,
    last_wash_date date,
    last_disinfect_date date,
    disinfectant_type character varying(100),
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: TABLE hall_hygiene; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hall_hygiene IS 'بهداشت و ضدعفونی سالن

';


--
-- Name: COLUMN hall_hygiene.last_wash_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_hygiene.last_wash_date IS 'آخرین تاریخ شستشو';


--
-- Name: COLUMN hall_hygiene.last_disinfect_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_hygiene.last_disinfect_date IS 'آخرین تاریخ ضدعفونی';


--
-- Name: COLUMN hall_hygiene.disinfectant_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_hygiene.disinfectant_type IS 'نوع ماده ضدعفونی مصرف شده';


--
-- Name: COLUMN hall_hygiene.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_hygiene.description IS 'توضیحات اضافی';


--
-- Name: COLUMN hall_hygiene.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_hygiene.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: hall_hygiene_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_hygiene_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_hygiene_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_hygiene_id_seq OWNED BY public.hall_hygiene.id;


--
-- Name: hall_physical_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_physical_info (
    id integer NOT NULL,
    hall_id integer NOT NULL,
    length numeric(10,2),
    width numeric(10,2),
    height numeric(10,2),
    area numeric(10,2),
    floor_type_id integer,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: TABLE hall_physical_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.hall_physical_info IS 'اطلاعات فیزیکی و ابعاد سالن‌های پرورش';


--
-- Name: COLUMN hall_physical_info.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.id IS 'شناسه یکتای رکورد';


--
-- Name: COLUMN hall_physical_info.hall_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.hall_id IS 'ارجاع به جدول halls - شناسه سالن';


--
-- Name: COLUMN hall_physical_info.length; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.length IS 'طول سالن (متر)';


--
-- Name: COLUMN hall_physical_info.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.width IS 'عرض سالن (متر)';


--
-- Name: COLUMN hall_physical_info.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.height IS 'ارتفاع سالن (متر)';


--
-- Name: COLUMN hall_physical_info.area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.area IS 'مساحت سالن (متر مربع)';


--
-- Name: COLUMN hall_physical_info.floor_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.floor_type_id IS 'نوع کفپوش (ارجاع به دیکشنری floor_types)';


--
-- Name: COLUMN hall_physical_info.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.notes IS 'توضیحات اضافی';


--
-- Name: COLUMN hall_physical_info.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_physical_info.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: hall_physical_info_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_physical_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_physical_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_physical_info_id_seq OWNED BY public.hall_physical_info.id;


--
-- Name: hall_system_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_system_items (
    id integer NOT NULL,
    system_id integer NOT NULL,
    category character varying(30),
    type_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    spec character varying(100),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    size character varying(50),
    capacity character varying(50)
);


--
-- Name: COLUMN hall_system_items.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.category IS 'دسته: heating | cooling | ventilation | fan | sanitary | lighting';


--
-- Name: COLUMN hall_system_items.type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.type_id IS 'شناسه نوع از دیکشنری مربوط (برای فن می‌تواند خالی باشد)';


--
-- Name: COLUMN hall_system_items.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.quantity IS 'تعداد از این نوع';


--
-- Name: COLUMN hall_system_items.spec; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.spec IS 'مشخصه/سایز (مثلاً فن ۳۶ اینچ یا ظرفیت) — برای سازگاری داده‌های قدیمی';


--
-- Name: COLUMN hall_system_items.size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.size IS 'اندازه/قطر فن (مثلاً ۳۶ اینچ)';


--
-- Name: COLUMN hall_system_items.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_system_items.capacity IS 'ظرفیت هوادهی فن (مترمکعب بر ساعت)';


--
-- Name: hall_system_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_system_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_system_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_system_items_id_seq OWNED BY public.hall_system_items.id;


--
-- Name: hall_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_systems (
    id integer NOT NULL,
    hall_id integer NOT NULL,
    fan_count integer,
    fan_size character varying(50),
    fan_capacity character varying(50),
    heater_count integer,
    heating_system_id integer,
    cooling_system_id integer,
    ventilation_system_id integer,
    water_inlet_system_id integer,
    lighting_system_id integer,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: COLUMN hall_systems.fan_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.fan_count IS 'تعداد فن‌ها';


--
-- Name: COLUMN hall_systems.fan_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.fan_size IS 'اندازه فن‌ها (مثلاً 36 اینچ)';


--
-- Name: COLUMN hall_systems.fan_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.fan_capacity IS 'ظرفیت فن‌ها (مثلاً 20000 CFM)';


--
-- Name: COLUMN hall_systems.heater_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.heater_count IS 'تعداد هیترها';


--
-- Name: COLUMN hall_systems.heating_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.heating_system_id IS 'نوع سیستم گرمایش (ارجاع به دیکشنری heating_systems)';


--
-- Name: COLUMN hall_systems.cooling_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.cooling_system_id IS 'نوع سیستم سرمایش (ارجاع به دیکشنری cooling_systems)';


--
-- Name: COLUMN hall_systems.ventilation_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.ventilation_system_id IS 'نوع سیستم تهویه (ارجاع به دیکشنری ventilation_systems)';


--
-- Name: COLUMN hall_systems.water_inlet_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.water_inlet_system_id IS 'نوع سیستم ورودی بهداشتی (ارجاع به دیکشنری water_inlet_types)';


--
-- Name: COLUMN hall_systems.lighting_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.lighting_system_id IS 'نوع سیستم روشنایی (ارجاع به دیکشنری lighting_systems)';


--
-- Name: COLUMN hall_systems.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.notes IS 'توضیحات اضافی';


--
-- Name: COLUMN hall_systems.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_systems.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: hall_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_systems_id_seq OWNED BY public.hall_systems.id;


--
-- Name: hall_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hall_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_types_id_seq OWNED BY public.hall_types.id;


--
-- Name: hall_water_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hall_water_feed (
    id integer NOT NULL,
    hall_id integer NOT NULL,
    waterer_type_id integer,
    feeder_type_id integer,
    water_lines_count integer,
    feed_lines_count integer,
    auto_feed_system boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: COLUMN hall_water_feed.waterer_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.waterer_type_id IS 'نوع آبخوری (ارجاع به دیکشنری waterer_types)';


--
-- Name: COLUMN hall_water_feed.feeder_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.feeder_type_id IS 'نوع دانخوری (ارجاع به دیکشنری feeder_types)';


--
-- Name: COLUMN hall_water_feed.water_lines_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.water_lines_count IS 'تعداد خطوط آبخوری';


--
-- Name: COLUMN hall_water_feed.feed_lines_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.feed_lines_count IS 'تعداد خطوط دانخوری';


--
-- Name: COLUMN hall_water_feed.auto_feed_system; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.auto_feed_system IS 'سیستم دان دهی اتوماتیک (دارد/ندارد)';


--
-- Name: COLUMN hall_water_feed.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.notes IS 'توضیحات اضافی';


--
-- Name: COLUMN hall_water_feed.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.hall_water_feed.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: hall_water_feed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hall_water_feed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hall_water_feed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hall_water_feed_id_seq OWNED BY public.hall_water_feed.id;


--
-- Name: halls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.halls (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    hall_name character varying(100) NOT NULL,
    hall_number character varying(50),
    hall_order integer DEFAULT 0 NOT NULL,
    nominal_capacity integer,
    altitude_above_sea integer,
    hall_type_id integer,
    construction_year integer,
    service_expert_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    operator_name character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    unit_id integer
);


--
-- Name: TABLE halls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.halls IS 'جداول مدیریت سالن‌ها';


--
-- Name: COLUMN halls.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.halls.is_active IS 'فعال یا غیرفعال بودن سالن';


--
-- Name: COLUMN halls.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.halls.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: halls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.halls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: halls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.halls_id_seq OWNED BY public.halls.id;


--
-- Name: heating_system_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.heating_system_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE heating_system_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.heating_system_types IS 'انواع سیستم گرمایشی

';


--
-- Name: heating_system_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.heating_system_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: heating_system_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.heating_system_types_id_seq OWNED BY public.heating_system_types.id;


--
-- Name: lighting_system_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lighting_system_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE lighting_system_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lighting_system_types IS 'انواع سیستم روشنایی

';


--
-- Name: lighting_system_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lighting_system_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lighting_system_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lighting_system_types_id_seq OWNED BY public.lighting_system_types.id;


--
-- Name: medicines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medicines (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    generic_name character varying(100),
    category character varying(50),
    manufacturer character varying(100),
    dosage_form character varying(50),
    unit character varying(20),
    concentration character varying(50),
    description text,
    indication text,
    contraindication text,
    side_effects text,
    withdrawal_time integer,
    storage_condition character varying(200),
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN medicines.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.category IS 'آنتی‌بیوتیک، واکسن، ضدعفونی‌کننده، مکمل، ویتامین';


--
-- Name: COLUMN medicines.dosage_form; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.dosage_form IS 'خوراکی، تزریقی، محلول در آب، اسپری';


--
-- Name: COLUMN medicines.unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.unit IS 'mg, ml, g, cc, عدد';


--
-- Name: COLUMN medicines.concentration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.concentration IS 'مقدار ماده موثره (مثلاً 20%)';


--
-- Name: COLUMN medicines.indication; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.indication IS 'موارد مصرف';


--
-- Name: COLUMN medicines.contraindication; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.contraindication IS 'موارد منع مصرف';


--
-- Name: COLUMN medicines.side_effects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.side_effects IS 'عوارض جانبی';


--
-- Name: COLUMN medicines.withdrawal_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.withdrawal_time IS 'دوره پرهیز از مصرف (روز)';


--
-- Name: COLUMN medicines.storage_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medicines.storage_condition IS 'شرایط نگهداری';


--
-- Name: medicines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medicines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medicines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medicines_id_seq OWNED BY public.medicines.id;


--
-- Name: period_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.period_statuses (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#6c757d'::character varying,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: period_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.period_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: period_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.period_statuses_id_seq OWNED BY public.period_statuses.id;


--
-- Name: periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periods (
    id integer NOT NULL,
    customer_personal_information_id integer NOT NULL,
    period_name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    period_number integer NOT NULL
);


--
-- Name: TABLE periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.periods IS 'دوره‌های پرورش';


--
-- Name: periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.periods_id_seq OWNED BY public.periods.id;


--
-- Name: release_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_note_items (
    id integer NOT NULL,
    release_note_id integer NOT NULL,
    category character varying(20) DEFAULT 'new'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    tag character varying(50),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN release_note_items.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_note_items.category IS 'new | improved | fixed | security';


--
-- Name: COLUMN release_note_items.tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_note_items.tag IS 'برچسب کوتاه (مثل: جدید / بهبود)';


--
-- Name: release_note_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.release_note_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: release_note_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.release_note_items_id_seq OWNED BY public.release_note_items.id;


--
-- Name: release_note_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_note_views (
    id integer NOT NULL,
    release_note_id integer NOT NULL,
    user_id integer NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL,
    dont_show_again boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN release_note_views.dont_show_again; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_note_views.dont_show_again IS 'کاربر «دیگر نشان نده» را زده است';


--
-- Name: release_note_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.release_note_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: release_note_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.release_note_views_id_seq OWNED BY public.release_note_views.id;


--
-- Name: release_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_notes (
    id integer NOT NULL,
    version character varying(20) NOT NULL,
    title character varying(150) DEFAULT 'تغییرات جدید'::character varying NOT NULL,
    description text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    audience character varying(20) DEFAULT 'all'::character varying NOT NULL,
    published_at timestamp with time zone,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN release_notes.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_notes.version IS 'شماره نسخه، مثل: 2.1.0';


--
-- Name: COLUMN release_notes.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_notes.description IS 'توضیح کوتاه بالای مودال';


--
-- Name: COLUMN release_notes.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_notes.status IS 'draft | published | archived';


--
-- Name: COLUMN release_notes.audience; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_notes.audience IS 'all | customers | experts | admins';


--
-- Name: COLUMN release_notes.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.release_notes.published_at IS 'زمان انتشار (آینده = انتشار زمان‌بندی‌شده)';


--
-- Name: release_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.release_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: release_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.release_notes_id_seq OWNED BY public.release_notes.id;


--
-- Name: sms_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_logs (
    id integer NOT NULL,
    customer_id integer,
    mobile character varying(20) NOT NULL,
    message text NOT NULL,
    type character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying,
    message_id character varying(100),
    error text,
    sent_by integer,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    flock_id integer,
    week_number integer,
    template_id integer,
    delivery_state smallint,
    flock_period_id integer,
    hall_id integer,
    scope character varying(10),
    target_title character varying(200),
    recipient_role character varying(100),
    recipient_name character varying(150),
    flock_number integer,
    CONSTRAINT sms_logs_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('sent'::character varying)::text, ('delivered'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: COLUMN sms_logs.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.type IS 'نوع پیام: reminder, week_reminder, confirmation, etc';


--
-- Name: COLUMN sms_logs.message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.message_id IS 'شناسه پیامک از سرویس';


--
-- Name: COLUMN sms_logs.error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.error IS 'خطا در صورت وجود';


--
-- Name: COLUMN sms_logs.flock_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.flock_id IS 'شناسه گله (برای سازگاری: در حالت سالن، شناسه جوجه‌ریزی/سالن)';


--
-- Name: COLUMN sms_logs.week_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.week_number IS 'شماره هفته';


--
-- Name: COLUMN sms_logs.template_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.template_id IS 'شناسه قالب استفاده شده';


--
-- Name: COLUMN sms_logs.delivery_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.delivery_state IS 'وضعیت تحویل از سرویس: 1=رسیده, 2=نرسیده, 3=رسیده به مخابرات, ...';


--
-- Name: COLUMN sms_logs.flock_period_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.flock_period_id IS 'شناسه گله/دوره پرورش (Flock)';


--
-- Name: COLUMN sms_logs.hall_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.hall_id IS 'شناسه جوجه‌ریزی/سالن هنگام ارسال برای یک سالن خاص';


--
-- Name: COLUMN sms_logs.scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.scope IS 'محدوده ارسال: flock = کل گله | hall = سالن';


--
-- Name: COLUMN sms_logs.target_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.target_title IS 'عنوان نمایشی هدف (مثلاً: گله ۱۲ یا گله ۱۲ - سالن B)';


--
-- Name: COLUMN sms_logs.recipient_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.recipient_role IS 'نقش گیرنده: کارشناس فارم / مدیر فارم / مرغدار';


--
-- Name: COLUMN sms_logs.recipient_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.recipient_name IS 'نام گیرنده';


--
-- Name: COLUMN sms_logs.flock_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_logs.flock_number IS 'شماره گله (Flock.flock_number) برای ارسال‌های سطح گله';


--
-- Name: sms_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sms_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sms_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sms_logs_id_seq OWNED BY public.sms_logs.id;


--
-- Name: suggestion_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestion_messages (
    id integer NOT NULL,
    suggestion_id integer NOT NULL,
    sender_type character varying(10) NOT NULL,
    sender_id integer,
    sender_name character varying(120),
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN suggestion_messages.sender_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestion_messages.sender_type IS 'user | admin';


--
-- Name: COLUMN suggestion_messages.read_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestion_messages.read_at IS 'زمان خواندن توسط طرف مقابل (رسید خواندن)';


--
-- Name: suggestion_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suggestion_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suggestion_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suggestion_messages_id_seq OWNED BY public.suggestion_messages.id;


--
-- Name: suggestion_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestion_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN suggestion_types.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestion_types.icon IS 'آیکون برای نمایش در فرانت‌اند';


--
-- Name: COLUMN suggestion_types.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestion_types.color IS 'رنگ برای نمایش (مثلاً #FF0000)';


--
-- Name: suggestion_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suggestion_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suggestion_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suggestion_types_id_seq OWNED BY public.suggestion_types.id;


--
-- Name: suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subject character varying(20) DEFAULT 'suggestion'::character varying NOT NULL,
    title character varying(150) NOT NULL,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    admin_unread boolean DEFAULT true NOT NULL,
    user_unread boolean DEFAULT false NOT NULL,
    messages_count integer DEFAULT 1 NOT NULL,
    last_message_at timestamp with time zone,
    last_sender character varying(10),
    page_url character varying(300),
    ip character varying(64),
    user_agent character varying(300),
    answered_by integer,
    answered_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN suggestions.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestions.user_id IS 'کاربری که گفتگو را شروع کرده است';


--
-- Name: COLUMN suggestions.subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestions.subject IS 'suggestion | complaint | bug | question | other';


--
-- Name: COLUMN suggestions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.suggestions.status IS 'new | in_progress | answered | closed';


--
-- Name: suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suggestions_id_seq OWNED BY public.suggestions.id;


--
-- Name: unit_experts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_experts (
    id integer NOT NULL,
    unit_id integer NOT NULL,
    expert_name character varying(50) NOT NULL,
    expert_phone character varying(20) NOT NULL,
    expert_role character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN unit_experts.expert_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unit_experts.expert_role IS 'نقش یا تخصص کارشناس';


--
-- Name: COLUMN unit_experts.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unit_experts.is_active IS 'فعال یا غیرفعال بودن کارشناس';


--
-- Name: unit_experts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unit_experts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unit_experts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unit_experts_id_seq OWNED BY public.unit_experts.id;


--
-- Name: unit_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_statuses (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#6c757d'::character varying,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: unit_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unit_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unit_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unit_statuses_id_seq OWNED BY public.unit_statuses.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id integer NOT NULL,
    customer_personal_information_id integer NOT NULL,
    unit_name character varying(100) NOT NULL,
    longitude numeric(10,7),
    latitude numeric(10,7),
    address text,
    hall_count integer,
    manager_name character varying(100),
    manager_phone character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    unit_status_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    capacity integer DEFAULT 0
);


--
-- Name: TABLE units; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.units IS 'جدول واحدهای مرغداری';


--
-- Name: COLUMN units.longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.longitude IS 'طول جغرافیایی واحد';


--
-- Name: COLUMN units.latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.latitude IS 'عرض جغرافیایی واحد';


--
-- Name: COLUMN units.address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.address IS 'آدرس واحد مرغداری';


--
-- Name: COLUMN units.hall_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.hall_count IS 'تعداد سالن‌های واحد';


--
-- Name: COLUMN units.manager_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.manager_name IS 'نام مدیر واحد';


--
-- Name: COLUMN units.manager_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.manager_phone IS 'شماره تماس مدیر واحد';


--
-- Name: COLUMN units.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.is_active IS 'فعال یا غیرفعال بودن واحد';


--
-- Name: COLUMN units.unit_status_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.unit_status_id IS 'وضعیت واحد (ارجاع به جدول unit_statuses)';


--
-- Name: COLUMN units.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.units.capacity IS 'ظرفیت کل واحد (قطعه)';


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    mobile_number character varying(20) NOT NULL,
    role character varying(20) DEFAULT 'customer'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    token character varying(500),
    token_expires_at timestamp with time zone,
    profile_image text,
    phone_number character varying(20),
    address text,
    bio text,
    last_login timestamp with time zone,
    last_login_ip character varying(45),
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    online_status boolean DEFAULT false,
    "isActive" boolean DEFAULT true
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'جدول مدیریت کاربران سیستم';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS 'شناسه یکتای کاربر';


--
-- Name: COLUMN users.first_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.first_name IS 'نام';


--
-- Name: COLUMN users.last_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_name IS 'نام خانوادگی';


--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.username IS 'نام کاربری (یکتا)';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email IS 'ایمیل (یکتا)';


--
-- Name: COLUMN users.password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password IS 'رمز عبور (هش شده)';


--
-- Name: COLUMN users.mobile_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.mobile_number IS 'شماره همراه (یکتا)';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.role IS 'نقش کاربر: admin, expert, customer';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.status IS 'وضعیت کاربر: active, inactive, pending, blocked';


--
-- Name: COLUMN users.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.token IS 'توکن JWT احراز هویت';


--
-- Name: COLUMN users.token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.token_expires_at IS 'تاریخ انقضای توکن';


--
-- Name: COLUMN users.profile_image; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_image IS 'آدرس عکس پروفایل';


--
-- Name: COLUMN users.last_login; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_login IS 'آخرین زمان ورود به سیستم';


--
-- Name: COLUMN users.failed_login_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.failed_login_attempts IS 'تعداد دفعات ورود ناموفق';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.locked_until IS 'زمان پایان قفل شدن حساب';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vaccines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vaccines (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    trade_name character varying(100),
    manufacturer character varying(100),
    vaccine_type character varying(50),
    administration_method character varying(50),
    target_disease character varying(100),
    age_days character varying(50),
    booster_needed boolean DEFAULT false,
    booster_days integer,
    immunity_duration integer,
    storage_temp character varying(50),
    dilution_ratio character varying(50),
    description text,
    precautions text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE vaccines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vaccines IS 'جدول واکسن ها';


--
-- Name: COLUMN vaccines.vaccine_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.vaccine_type IS 'زنده, کشته, تخفیف حدت یافته, نوترکیب';


--
-- Name: COLUMN vaccines.administration_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.administration_method IS 'قطره چشمی, آشامیدنی, تزریقی, اسپری';


--
-- Name: COLUMN vaccines.target_disease; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.target_disease IS 'بیماری هدف (مثل نیوکاسل، گامبورو، برونشیت)';


--
-- Name: COLUMN vaccines.age_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.age_days IS 'سن توصیه شده برای تزریق (مثلاً ۱-۷ روزگی)';


--
-- Name: COLUMN vaccines.booster_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.booster_days IS 'فاصله تا دوز بعدی (روز)';


--
-- Name: COLUMN vaccines.immunity_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.immunity_duration IS 'مدت زمان ایمنی (روز)';


--
-- Name: COLUMN vaccines.storage_temp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.storage_temp IS 'دمای نگهداری (مثلاً ۲-۸ درجه)';


--
-- Name: COLUMN vaccines.dilution_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.dilution_ratio IS 'نسبت رقیق‌سازی';


--
-- Name: COLUMN vaccines.precautions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccines.precautions IS 'نکات احتیاطی';


--
-- Name: vaccines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vaccines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vaccines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vaccines_id_seq OWNED BY public.vaccines.id;


--
-- Name: ventilation_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventilation_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    ventilation_method character varying(50),
    fan_type character varying(50),
    air_flow_direction character varying(30),
    automatic_control boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE ventilation_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ventilation_types IS 'انواع سیستم تهویه';


--
-- Name: ventilation_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ventilation_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ventilation_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ventilation_types_id_seq OWNED BY public.ventilation_types.id;


--
-- Name: visit_report_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_report_attachments (
    id integer NOT NULL,
    visit_report_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100)
);


--
-- Name: visit_report_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_report_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_report_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_report_attachments_id_seq OWNED BY public.visit_report_attachments.id;


--
-- Name: visit_report_experts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_report_experts (
    id integer NOT NULL,
    visit_report_id integer NOT NULL,
    expert_id integer NOT NULL
);


--
-- Name: visit_report_experts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_report_experts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_report_experts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_report_experts_id_seq OWNED BY public.visit_report_experts.id;


--
-- Name: visit_report_halls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_report_halls (
    id integer NOT NULL,
    visit_report_id integer NOT NULL,
    hall_id integer NOT NULL
);


--
-- Name: visit_report_halls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_report_halls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_report_halls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_report_halls_id_seq OWNED BY public.visit_report_halls.id;


--
-- Name: visit_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_reports (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    visit_date date NOT NULL,
    forward_to character varying(50),
    report_text text,
    status character varying(20) DEFAULT 'unread'::character varying,
    created_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: COLUMN visit_reports.unit_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visit_reports.unit_id IS 'شناسه واحد مرغداری';


--
-- Name: visit_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_reports_id_seq OWNED BY public.visit_reports.id;


--
-- Name: water_inlet_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.water_inlet_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: water_inlet_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.water_inlet_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: water_inlet_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.water_inlet_types_id_seq OWNED BY public.water_inlet_types.id;


--
-- Name: waterer_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waterer_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    waterer_category character varying(50),
    material character varying(50),
    capacity character varying(50),
    bird_count integer,
    automatic boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: waterer_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waterer_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waterer_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waterer_types_id_seq OWNED BY public.waterer_types.id;


--
-- Name: weekly_diseases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_diseases (
    id integer NOT NULL,
    weekly_management_id integer NOT NULL,
    disease_id integer NOT NULL,
    customer_id integer,
    hall_id integer,
    chick_placement_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: weekly_diseases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_diseases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_diseases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_diseases_id_seq OWNED BY public.weekly_diseases.id;


--
-- Name: weekly_feeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_feeds (
    id integer NOT NULL,
    weekly_management_id integer NOT NULL,
    feed_type_id integer NOT NULL,
    customer_id integer,
    hall_id integer,
    chick_placement_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: weekly_feeds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_feeds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_feeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_feeds_id_seq OWNED BY public.weekly_feeds.id;


--
-- Name: weekly_management; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_management (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    hall_id integer NOT NULL,
    chick_placement_id integer NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    week_number integer NOT NULL,
    flock_age_days integer NOT NULL,
    service_expert_id integer,
    daily_feed_intake numeric(10,2),
    weekly_feed_intake numeric(10,2),
    weekly_weight numeric(10,2),
    weekly_mortality integer DEFAULT 0,
    blackout_hours numeric(5,2) DEFAULT 0,
    additional_notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    is_active boolean DEFAULT true,
    unit_id integer
);


--
-- Name: weekly_management_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_management_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_management_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_management_id_seq OWNED BY public.weekly_management.id;


--
-- Name: weekly_medicines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_medicines (
    id integer NOT NULL,
    weekly_management_id integer NOT NULL,
    medicine_id integer NOT NULL,
    customer_id integer,
    hall_id integer,
    chick_placement_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: weekly_medicines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_medicines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_medicines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_medicines_id_seq OWNED BY public.weekly_medicines.id;


--
-- Name: weekly_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_suggestions (
    id integer NOT NULL,
    weekly_management_id integer NOT NULL,
    suggestion_id integer NOT NULL,
    customer_id integer,
    hall_id integer,
    chick_placement_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: weekly_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_suggestions_id_seq OWNED BY public.weekly_suggestions.id;


--
-- Name: weekly_vaccines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_vaccines (
    id integer NOT NULL,
    weekly_management_id integer NOT NULL,
    vaccine_id integer NOT NULL,
    customer_id integer,
    hall_id integer,
    chick_placement_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    unit_id integer
);


--
-- Name: weekly_vaccines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_vaccines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_vaccines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_vaccines_id_seq OWNED BY public.weekly_vaccines.id;


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: bookmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks ALTER COLUMN id SET DEFAULT nextval('public.bookmarks_id_seq'::regclass);


--
-- Name: breed_weight_standards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards ALTER COLUMN id SET DEFAULT nextval('public.breed_weight_standards_id_seq'::regclass);


--
-- Name: chick_placements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements ALTER COLUMN id SET DEFAULT nextval('public.chick_placements_id_seq'::regclass);


--
-- Name: chick_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_sources ALTER COLUMN id SET DEFAULT nextval('public.chick_sources_id_seq'::regclass);


--
-- Name: chicken_breeds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chicken_breeds ALTER COLUMN id SET DEFAULT nextval('public.chicken_breeds_id_seq'::regclass);


--
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_id_seq'::regclass);


--
-- Name: cooling_system_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooling_system_types ALTER COLUMN id SET DEFAULT nextval('public.cooling_system_types_id_seq'::regclass);


--
-- Name: crop_test id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test ALTER COLUMN id SET DEFAULT nextval('public.crop_test_id_seq'::regclass);


--
-- Name: customer_personal_information id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information ALTER COLUMN id SET DEFAULT nextval('public.customer_personal_information_id_seq'::regclass);


--
-- Name: customer_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_types ALTER COLUMN id SET DEFAULT nextval('public.customer_types_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: diseases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diseases ALTER COLUMN id SET DEFAULT nextval('public.diseases_id_seq'::regclass);


--
-- Name: education_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels ALTER COLUMN id SET DEFAULT nextval('public.education_levels_id_seq'::regclass);


--
-- Name: feed_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_types ALTER COLUMN id SET DEFAULT nextval('public.feed_types_id_seq'::regclass);


--
-- Name: feeder_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feeder_types ALTER COLUMN id SET DEFAULT nextval('public.feeder_types_id_seq'::regclass);


--
-- Name: flock_completion_halls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls ALTER COLUMN id SET DEFAULT nextval('public.flock_completion_halls_id_seq'::regclass);


--
-- Name: flock_completions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions ALTER COLUMN id SET DEFAULT nextval('public.flock_completions_id_seq'::regclass);


--
-- Name: flocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flocks ALTER COLUMN id SET DEFAULT nextval('public.flocks_id_seq'::regclass);


--
-- Name: floor_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floor_types ALTER COLUMN id SET DEFAULT nextval('public.floor_types_id_seq'::regclass);


--
-- Name: hall_hygiene id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_hygiene ALTER COLUMN id SET DEFAULT nextval('public.hall_hygiene_id_seq'::regclass);


--
-- Name: hall_physical_info id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_physical_info ALTER COLUMN id SET DEFAULT nextval('public.hall_physical_info_id_seq'::regclass);


--
-- Name: hall_system_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_system_items ALTER COLUMN id SET DEFAULT nextval('public.hall_system_items_id_seq'::regclass);


--
-- Name: hall_systems id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_systems ALTER COLUMN id SET DEFAULT nextval('public.hall_systems_id_seq'::regclass);


--
-- Name: hall_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_types ALTER COLUMN id SET DEFAULT nextval('public.hall_types_id_seq'::regclass);


--
-- Name: hall_water_feed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_water_feed ALTER COLUMN id SET DEFAULT nextval('public.hall_water_feed_id_seq'::regclass);


--
-- Name: halls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.halls ALTER COLUMN id SET DEFAULT nextval('public.halls_id_seq'::regclass);


--
-- Name: heating_system_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heating_system_types ALTER COLUMN id SET DEFAULT nextval('public.heating_system_types_id_seq'::regclass);


--
-- Name: lighting_system_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lighting_system_types ALTER COLUMN id SET DEFAULT nextval('public.lighting_system_types_id_seq'::regclass);


--
-- Name: medicines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicines ALTER COLUMN id SET DEFAULT nextval('public.medicines_id_seq'::regclass);


--
-- Name: period_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.period_statuses ALTER COLUMN id SET DEFAULT nextval('public.period_statuses_id_seq'::regclass);


--
-- Name: periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods ALTER COLUMN id SET DEFAULT nextval('public.periods_id_seq'::regclass);


--
-- Name: release_note_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_items ALTER COLUMN id SET DEFAULT nextval('public.release_note_items_id_seq'::regclass);


--
-- Name: release_note_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_views ALTER COLUMN id SET DEFAULT nextval('public.release_note_views_id_seq'::regclass);


--
-- Name: release_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_notes ALTER COLUMN id SET DEFAULT nextval('public.release_notes_id_seq'::regclass);


--
-- Name: sms_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs ALTER COLUMN id SET DEFAULT nextval('public.sms_logs_id_seq'::regclass);


--
-- Name: suggestion_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_messages ALTER COLUMN id SET DEFAULT nextval('public.suggestion_messages_id_seq'::regclass);


--
-- Name: suggestion_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_types ALTER COLUMN id SET DEFAULT nextval('public.suggestion_types_id_seq'::regclass);


--
-- Name: suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions ALTER COLUMN id SET DEFAULT nextval('public.suggestions_id_seq'::regclass);


--
-- Name: unit_experts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_experts ALTER COLUMN id SET DEFAULT nextval('public.unit_experts_id_seq'::regclass);


--
-- Name: unit_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_statuses ALTER COLUMN id SET DEFAULT nextval('public.unit_statuses_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vaccines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccines ALTER COLUMN id SET DEFAULT nextval('public.vaccines_id_seq'::regclass);


--
-- Name: ventilation_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventilation_types ALTER COLUMN id SET DEFAULT nextval('public.ventilation_types_id_seq'::regclass);


--
-- Name: visit_report_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_attachments ALTER COLUMN id SET DEFAULT nextval('public.visit_report_attachments_id_seq'::regclass);


--
-- Name: visit_report_experts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_experts ALTER COLUMN id SET DEFAULT nextval('public.visit_report_experts_id_seq'::regclass);


--
-- Name: visit_report_halls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_halls ALTER COLUMN id SET DEFAULT nextval('public.visit_report_halls_id_seq'::regclass);


--
-- Name: visit_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_reports ALTER COLUMN id SET DEFAULT nextval('public.visit_reports_id_seq'::regclass);


--
-- Name: water_inlet_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_inlet_types ALTER COLUMN id SET DEFAULT nextval('public.water_inlet_types_id_seq'::regclass);


--
-- Name: waterer_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterer_types ALTER COLUMN id SET DEFAULT nextval('public.waterer_types_id_seq'::regclass);


--
-- Name: weekly_diseases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_diseases ALTER COLUMN id SET DEFAULT nextval('public.weekly_diseases_id_seq'::regclass);


--
-- Name: weekly_feeds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_feeds ALTER COLUMN id SET DEFAULT nextval('public.weekly_feeds_id_seq'::regclass);


--
-- Name: weekly_management id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management ALTER COLUMN id SET DEFAULT nextval('public.weekly_management_id_seq'::regclass);


--
-- Name: weekly_medicines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_medicines ALTER COLUMN id SET DEFAULT nextval('public.weekly_medicines_id_seq'::regclass);


--
-- Name: weekly_suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_suggestions ALTER COLUMN id SET DEFAULT nextval('public.weekly_suggestions_id_seq'::regclass);


--
-- Name: weekly_vaccines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_vaccines ALTER COLUMN id SET DEFAULT nextval('public.weekly_vaccines_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: breed_weight_standards breed_weight_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards
    ADD CONSTRAINT breed_weight_standards_pkey PRIMARY KEY (id);


--
-- Name: chick_placements chick_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_pkey PRIMARY KEY (id);


--
-- Name: chick_sources chick_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_sources
    ADD CONSTRAINT chick_sources_pkey PRIMARY KEY (id);


--
-- Name: chicken_breeds chicken_breeds_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chicken_breeds
    ADD CONSTRAINT chicken_breeds_code_key UNIQUE (code);


--
-- Name: chicken_breeds chicken_breeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chicken_breeds
    ADD CONSTRAINT chicken_breeds_pkey PRIMARY KEY (id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cooling_system_types cooling_system_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooling_system_types
    ADD CONSTRAINT cooling_system_types_pkey PRIMARY KEY (id);


--
-- Name: crop_test crop_test_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test
    ADD CONSTRAINT crop_test_pkey PRIMARY KEY (id);


--
-- Name: customer_personal_information customer_personal_information_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_customer_code_key UNIQUE (customer_code);


--
-- Name: customer_personal_information customer_personal_information_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key1 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key10 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key11 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key12 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key13 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key14 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key15 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key2 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key3 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key4 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key5 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key6 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key7 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key8 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_email_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_email_key9 UNIQUE (email);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key1 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key10 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key11 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key12 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key13 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key14 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key15 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key16 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key17 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key18 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key19 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key2 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key20 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key21 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key22 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key23 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key24 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key25 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key26; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key26 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key27; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key27 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key28; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key28 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key29; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key29 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key3 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key30; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key30 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key31; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key31 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key32; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key32 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key33; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key33 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key34; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key34 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key35; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key35 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key36; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key36 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key37; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key37 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key38; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key38 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key39; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key39 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key4 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key40; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key40 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key41; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key41 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key42 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key43; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key43 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key44; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key44 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key45; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key45 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key46; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key46 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key47; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key47 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key48; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key48 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key49; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key49 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key5 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key50; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key50 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key51; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key51 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key52; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key52 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key53; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key53 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key54; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key54 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key55; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key55 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key56; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key56 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key57; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key57 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key58 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key59 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key6 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key7 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key8 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_mobile_number_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_mobile_number_key9 UNIQUE (mobile_number);


--
-- Name: customer_personal_information customer_personal_information_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_pkey PRIMARY KEY (id);


--
-- Name: customer_types customer_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_types
    ADD CONSTRAINT customer_types_name_key UNIQUE (name);


--
-- Name: customer_types customer_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_types
    ADD CONSTRAINT customer_types_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: departments departments_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_title_key UNIQUE (title);


--
-- Name: diseases diseases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diseases
    ADD CONSTRAINT diseases_pkey PRIMARY KEY (id);


--
-- Name: education_levels education_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels
    ADD CONSTRAINT education_levels_pkey PRIMARY KEY (id);


--
-- Name: education_levels education_levels_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_levels
    ADD CONSTRAINT education_levels_title_key UNIQUE (title);


--
-- Name: feed_types feed_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_types
    ADD CONSTRAINT feed_types_pkey PRIMARY KEY (id);


--
-- Name: feeder_types feeder_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feeder_types
    ADD CONSTRAINT feeder_types_pkey PRIMARY KEY (id);


--
-- Name: flock_completion_halls flock_completion_halls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls
    ADD CONSTRAINT flock_completion_halls_pkey PRIMARY KEY (id);


--
-- Name: flock_completions flock_completions_chick_placement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT flock_completions_chick_placement_id_key UNIQUE (chick_placement_id);


--
-- Name: flock_completions flock_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT flock_completions_pkey PRIMARY KEY (id);


--
-- Name: flocks flocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flocks
    ADD CONSTRAINT flocks_pkey PRIMARY KEY (id);


--
-- Name: floor_types floor_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floor_types
    ADD CONSTRAINT floor_types_pkey PRIMARY KEY (id);


--
-- Name: hall_hygiene hall_hygiene_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_hygiene
    ADD CONSTRAINT hall_hygiene_pkey PRIMARY KEY (id);


--
-- Name: hall_physical_info hall_physical_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_physical_info
    ADD CONSTRAINT hall_physical_info_pkey PRIMARY KEY (id);


--
-- Name: hall_system_items hall_system_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_system_items
    ADD CONSTRAINT hall_system_items_pkey PRIMARY KEY (id);


--
-- Name: hall_systems hall_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_systems
    ADD CONSTRAINT hall_systems_pkey PRIMARY KEY (id);


--
-- Name: hall_types hall_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_types
    ADD CONSTRAINT hall_types_name_key UNIQUE (name);


--
-- Name: hall_types hall_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_types
    ADD CONSTRAINT hall_types_pkey PRIMARY KEY (id);


--
-- Name: hall_water_feed hall_water_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_water_feed
    ADD CONSTRAINT hall_water_feed_pkey PRIMARY KEY (id);


--
-- Name: halls halls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.halls
    ADD CONSTRAINT halls_pkey PRIMARY KEY (id);


--
-- Name: heating_system_types heating_system_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heating_system_types
    ADD CONSTRAINT heating_system_types_pkey PRIMARY KEY (id);


--
-- Name: lighting_system_types lighting_system_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lighting_system_types
    ADD CONSTRAINT lighting_system_types_pkey PRIMARY KEY (id);


--
-- Name: medicines medicines_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_name_key UNIQUE (name);


--
-- Name: medicines medicines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_pkey PRIMARY KEY (id);


--
-- Name: period_statuses period_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.period_statuses
    ADD CONSTRAINT period_statuses_name_key UNIQUE (name);


--
-- Name: period_statuses period_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.period_statuses
    ADD CONSTRAINT period_statuses_pkey PRIMARY KEY (id);


--
-- Name: periods periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_pkey PRIMARY KEY (id);


--
-- Name: release_note_items release_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_items
    ADD CONSTRAINT release_note_items_pkey PRIMARY KEY (id);


--
-- Name: release_note_views release_note_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_views
    ADD CONSTRAINT release_note_views_pkey PRIMARY KEY (id);


--
-- Name: release_notes release_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_notes
    ADD CONSTRAINT release_notes_pkey PRIMARY KEY (id);


--
-- Name: release_notes release_notes_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_notes
    ADD CONSTRAINT release_notes_version_key UNIQUE (version);


--
-- Name: sms_logs sms_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);


--
-- Name: suggestion_messages suggestion_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_messages
    ADD CONSTRAINT suggestion_messages_pkey PRIMARY KEY (id);


--
-- Name: suggestion_types suggestion_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_types
    ADD CONSTRAINT suggestion_types_name_key UNIQUE (name);


--
-- Name: suggestion_types suggestion_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_types
    ADD CONSTRAINT suggestion_types_pkey PRIMARY KEY (id);


--
-- Name: suggestions suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);


--
-- Name: breed_weight_standards unique_breed_week; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards
    ADD CONSTRAINT unique_breed_week UNIQUE (breed_id, week_number);


--
-- Name: unit_experts unit_experts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_experts
    ADD CONSTRAINT unit_experts_pkey PRIMARY KEY (id);


--
-- Name: unit_statuses unit_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_statuses
    ADD CONSTRAINT unit_statuses_name_key UNIQUE (name);


--
-- Name: unit_statuses unit_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_statuses
    ADD CONSTRAINT unit_statuses_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_mobile_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_number_key UNIQUE (mobile_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: vaccines vaccines_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccines
    ADD CONSTRAINT vaccines_name_key UNIQUE (name);


--
-- Name: vaccines vaccines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccines
    ADD CONSTRAINT vaccines_pkey PRIMARY KEY (id);


--
-- Name: ventilation_types ventilation_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventilation_types
    ADD CONSTRAINT ventilation_types_name_key UNIQUE (name);


--
-- Name: ventilation_types ventilation_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventilation_types
    ADD CONSTRAINT ventilation_types_pkey PRIMARY KEY (id);


--
-- Name: visit_report_attachments visit_report_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_attachments
    ADD CONSTRAINT visit_report_attachments_pkey PRIMARY KEY (id);


--
-- Name: visit_report_experts visit_report_experts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_experts
    ADD CONSTRAINT visit_report_experts_pkey PRIMARY KEY (id);


--
-- Name: visit_report_experts visit_report_experts_visit_report_id_expert_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_experts
    ADD CONSTRAINT visit_report_experts_visit_report_id_expert_id_key UNIQUE (visit_report_id, expert_id);


--
-- Name: visit_report_halls visit_report_halls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_halls
    ADD CONSTRAINT visit_report_halls_pkey PRIMARY KEY (id);


--
-- Name: visit_report_halls visit_report_halls_visit_report_id_hall_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_halls
    ADD CONSTRAINT visit_report_halls_visit_report_id_hall_id_key UNIQUE (visit_report_id, hall_id);


--
-- Name: visit_reports visit_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_pkey PRIMARY KEY (id);


--
-- Name: water_inlet_types water_inlet_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_inlet_types
    ADD CONSTRAINT water_inlet_types_name_key UNIQUE (name);


--
-- Name: water_inlet_types water_inlet_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.water_inlet_types
    ADD CONSTRAINT water_inlet_types_pkey PRIMARY KEY (id);


--
-- Name: waterer_types waterer_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterer_types
    ADD CONSTRAINT waterer_types_name_key UNIQUE (name);


--
-- Name: waterer_types waterer_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waterer_types
    ADD CONSTRAINT waterer_types_pkey PRIMARY KEY (id);


--
-- Name: weekly_diseases weekly_diseases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_diseases
    ADD CONSTRAINT weekly_diseases_pkey PRIMARY KEY (id);


--
-- Name: weekly_feeds weekly_feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_feeds
    ADD CONSTRAINT weekly_feeds_pkey PRIMARY KEY (id);


--
-- Name: weekly_management weekly_management_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management
    ADD CONSTRAINT weekly_management_pkey PRIMARY KEY (id);


--
-- Name: weekly_medicines weekly_medicines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_medicines
    ADD CONSTRAINT weekly_medicines_pkey PRIMARY KEY (id);


--
-- Name: weekly_suggestions weekly_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_suggestions
    ADD CONSTRAINT weekly_suggestions_pkey PRIMARY KEY (id);


--
-- Name: weekly_vaccines weekly_vaccines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_vaccines
    ADD CONSTRAINT weekly_vaccines_pkey PRIMARY KEY (id);


--
-- Name: app_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_settings_key ON public.app_settings USING btree (key);


--
-- Name: breed_weight_standards_breed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX breed_weight_standards_breed_id ON public.breed_weight_standards USING btree (breed_id);


--
-- Name: breed_weight_standards_breed_id_week_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX breed_weight_standards_breed_id_week_number ON public.breed_weight_standards USING btree (breed_id, week_number);


--
-- Name: breed_weight_standards_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX breed_weight_standards_is_active ON public.breed_weight_standards USING btree (is_active);


--
-- Name: breed_weight_standards_week_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX breed_weight_standards_week_number ON public.breed_weight_standards USING btree (week_number);


--
-- Name: chick_placements_customer_id_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chick_placements_customer_id_is_active ON public.chick_placements USING btree (customer_id, is_active);


--
-- Name: chick_placements_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chick_placements_flock_id ON public.chick_placements USING btree (flock_id);


--
-- Name: customer_personal_information_customer_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_personal_information_customer_type_id ON public.customer_personal_information USING btree (customer_type_id);


--
-- Name: customer_personal_information_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_personal_information_email ON public.customer_personal_information USING btree (email);


--
-- Name: customer_personal_information_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_personal_information_full_name ON public.customer_personal_information USING btree (full_name);


--
-- Name: customer_personal_information_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_personal_information_mobile_number ON public.customer_personal_information USING btree (mobile_number);


--
-- Name: customer_personal_information_province; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_personal_information_province ON public.customer_personal_information USING btree (province);


--
-- Name: customer_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_types_active ON public.customer_types USING btree (active);


--
-- Name: flock_completion_halls_chick_placement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completion_halls_chick_placement_id ON public.flock_completion_halls USING btree (chick_placement_id);


--
-- Name: flock_completion_halls_flock_completion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completion_halls_flock_completion_id ON public.flock_completion_halls USING btree (flock_completion_id);


--
-- Name: flock_completion_halls_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completion_halls_flock_id ON public.flock_completion_halls USING btree (flock_id);


--
-- Name: flock_completion_halls_hall_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completion_halls_hall_id ON public.flock_completion_halls USING btree (hall_id);


--
-- Name: flock_completions_chick_placement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flock_completions_chick_placement_id ON public.flock_completions USING btree (chick_placement_id);


--
-- Name: flock_completions_completion_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completions_completion_date ON public.flock_completions USING btree (completion_date);


--
-- Name: flock_completions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completions_customer_id ON public.flock_completions USING btree (customer_id);


--
-- Name: flock_completions_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flock_completions_flock_id ON public.flock_completions USING btree (flock_id);


--
-- Name: flock_completions_hall_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completions_hall_id ON public.flock_completions USING btree (hall_id);


--
-- Name: flock_completions_slaughter_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completions_slaughter_date ON public.flock_completions USING btree (slaughter_date);


--
-- Name: flock_completions_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flock_completions_unit_id ON public.flock_completions USING btree (unit_id);


--
-- Name: flocks_unit_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flocks_unit_id_status ON public.flocks USING btree (unit_id, status);


--
-- Name: hall_system_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hall_system_items_category ON public.hall_system_items USING btree (category);


--
-- Name: hall_system_items_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hall_system_items_system_id ON public.hall_system_items USING btree (system_id);


--
-- Name: halls_customer_id_unit_id_hall_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX halls_customer_id_unit_id_hall_number ON public.halls USING btree (customer_id, unit_id, hall_number);


--
-- Name: idx_bookmarks_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_assigned_to ON public.bookmarks USING btree (assigned_to);


--
-- Name: idx_bookmarks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_created_by ON public.bookmarks USING btree (created_by);


--
-- Name: idx_bookmarks_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_customer_id ON public.bookmarks USING btree (customer_id);


--
-- Name: idx_bookmarks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_due_date ON public.bookmarks USING btree (due_date);


--
-- Name: idx_bookmarks_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_flock_id ON public.bookmarks USING btree (flock_id);


--
-- Name: idx_bookmarks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_priority ON public.bookmarks USING btree (priority);


--
-- Name: idx_bookmarks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_status ON public.bookmarks USING btree (status);


--
-- Name: idx_bookmarks_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_type ON public.bookmarks USING btree (type);


--
-- Name: idx_breed_weight_standards_breed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_breed_weight_standards_breed ON public.breed_weight_standards USING btree (breed_id);


--
-- Name: idx_breed_weight_standards_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_breed_weight_standards_source ON public.breed_weight_standards USING btree (source_type);


--
-- Name: idx_breed_weight_standards_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_breed_weight_standards_week ON public.breed_weight_standards USING btree (week_number);


--
-- Name: idx_customer_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_email ON public.customer_personal_information USING btree (email);


--
-- Name: idx_customer_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_full_name ON public.customer_personal_information USING btree (full_name);


--
-- Name: idx_customer_mobile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_mobile ON public.customer_personal_information USING btree (mobile_number);


--
-- Name: idx_customer_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_updated_at ON public.customer_personal_information USING btree (updated_at);


--
-- Name: idx_flock_completions_chick_placement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flock_completions_chick_placement ON public.flock_completions USING btree (chick_placement_id);


--
-- Name: idx_flock_completions_completion_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flock_completions_completion_date ON public.flock_completions USING btree (completion_date);


--
-- Name: idx_flock_completions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flock_completions_customer ON public.flock_completions USING btree (customer_id);


--
-- Name: idx_flock_completions_hall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flock_completions_hall ON public.flock_completions USING btree (hall_id);


--
-- Name: idx_flock_completions_slaughter_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flock_completions_slaughter_date ON public.flock_completions USING btree (slaughter_date);


--
-- Name: idx_hall_physical_floor_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hall_physical_floor_type ON public.hall_physical_info USING btree (floor_type_id);


--
-- Name: idx_hall_physical_hall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hall_physical_hall ON public.hall_physical_info USING btree (hall_id);


--
-- Name: idx_halls_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_halls_customer ON public.halls USING btree (customer_id);


--
-- Name: idx_halls_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_halls_name ON public.halls USING btree (hall_name);


--
-- Name: idx_periods_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_periods_customer ON public.customer_personal_information USING btree (id);


--
-- Name: idx_sms_logs_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_customer_id ON public.sms_logs USING btree (customer_id);


--
-- Name: idx_sms_logs_delivery_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_delivery_state ON public.sms_logs USING btree (delivery_state);


--
-- Name: idx_sms_logs_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_flock_id ON public.sms_logs USING btree (flock_id);


--
-- Name: idx_sms_logs_mobile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_mobile ON public.sms_logs USING btree (mobile);


--
-- Name: idx_sms_logs_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_sent_at ON public.sms_logs USING btree (sent_at);


--
-- Name: idx_sms_logs_sent_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_sent_by ON public.sms_logs USING btree (sent_by);


--
-- Name: idx_sms_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_status ON public.sms_logs USING btree (status);


--
-- Name: idx_sms_logs_week_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_week_number ON public.sms_logs USING btree (week_number);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- Name: idx_users_mobile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_mobile ON public.users USING btree (mobile_number);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_role_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_status ON public.users USING btree (role, status);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_users_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_token ON public.users USING btree (token);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_visit_reports_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_reports_customer ON public.visit_reports USING btree (customer_id);


--
-- Name: idx_visit_reports_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_reports_date ON public.visit_reports USING btree (visit_date);


--
-- Name: idx_visit_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_reports_status ON public.visit_reports USING btree (status);


--
-- Name: idx_weekly_chick_placement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_chick_placement_id ON public.weekly_management USING btree (chick_placement_id);


--
-- Name: idx_weekly_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_customer_id ON public.weekly_management USING btree (customer_id);


--
-- Name: idx_weekly_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_dates ON public.weekly_management USING btree (week_start_date, week_end_date);


--
-- Name: idx_weekly_diseases_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_diseases_customer ON public.weekly_diseases USING btree (customer_id);


--
-- Name: idx_weekly_diseases_disease_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_diseases_disease_id ON public.weekly_diseases USING btree (disease_id);


--
-- Name: idx_weekly_diseases_weekly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_diseases_weekly_id ON public.weekly_diseases USING btree (weekly_management_id);


--
-- Name: idx_weekly_feeds_feed_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_feeds_feed_type_id ON public.weekly_feeds USING btree (feed_type_id);


--
-- Name: idx_weekly_feeds_weekly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_feeds_weekly_id ON public.weekly_feeds USING btree (weekly_management_id);


--
-- Name: idx_weekly_hall_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_hall_id ON public.weekly_management USING btree (hall_id);


--
-- Name: idx_weekly_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_is_active ON public.weekly_management USING btree (is_active);


--
-- Name: idx_weekly_medicines_medicine_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_medicines_medicine_id ON public.weekly_medicines USING btree (medicine_id);


--
-- Name: idx_weekly_medicines_weekly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_medicines_weekly_id ON public.weekly_medicines USING btree (weekly_management_id);


--
-- Name: idx_weekly_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_status ON public.weekly_management USING btree (status);


--
-- Name: idx_weekly_suggestions_suggestion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_suggestions_suggestion_id ON public.weekly_suggestions USING btree (suggestion_id);


--
-- Name: idx_weekly_suggestions_weekly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_suggestions_weekly_id ON public.weekly_suggestions USING btree (weekly_management_id);


--
-- Name: idx_weekly_vaccines_vaccine_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_vaccines_vaccine_id ON public.weekly_vaccines USING btree (vaccine_id);


--
-- Name: idx_weekly_vaccines_weekly_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_vaccines_weekly_id ON public.weekly_vaccines USING btree (weekly_management_id);


--
-- Name: idx_weekly_week_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_week_number ON public.weekly_management USING btree (week_number);


--
-- Name: release_note_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_note_items_category ON public.release_note_items USING btree (category);


--
-- Name: release_note_items_release_note_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_note_items_release_note_id ON public.release_note_items USING btree (release_note_id);


--
-- Name: release_note_views_release_note_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_note_views_release_note_id ON public.release_note_views USING btree (release_note_id);


--
-- Name: release_note_views_release_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX release_note_views_release_user_unique ON public.release_note_views USING btree (release_note_id, user_id);


--
-- Name: release_note_views_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_note_views_user_id ON public.release_note_views USING btree (user_id);


--
-- Name: release_notes_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_notes_audience ON public.release_notes USING btree (audience);


--
-- Name: release_notes_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_notes_published_at ON public.release_notes USING btree (published_at);


--
-- Name: release_notes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_notes_status ON public.release_notes USING btree (status);


--
-- Name: sms_logs_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_customer_id ON public.sms_logs USING btree (customer_id);


--
-- Name: sms_logs_flock_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_flock_id ON public.sms_logs USING btree (flock_id);


--
-- Name: sms_logs_flock_period_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_flock_period_id ON public.sms_logs USING btree (flock_period_id);


--
-- Name: sms_logs_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_message_id ON public.sms_logs USING btree (message_id);


--
-- Name: sms_logs_mobile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_mobile ON public.sms_logs USING btree (mobile);


--
-- Name: sms_logs_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_sent_at ON public.sms_logs USING btree (sent_at);


--
-- Name: sms_logs_sent_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_sent_by ON public.sms_logs USING btree (sent_by);


--
-- Name: sms_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_logs_status ON public.sms_logs USING btree (status);


--
-- Name: suggestion_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestion_messages_created_at ON public.suggestion_messages USING btree (created_at);


--
-- Name: suggestion_messages_suggestion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestion_messages_suggestion_id ON public.suggestion_messages USING btree (suggestion_id);


--
-- Name: suggestions_admin_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_admin_unread ON public.suggestions USING btree (admin_unread);


--
-- Name: suggestions_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_last_message_at ON public.suggestions USING btree (last_message_at);


--
-- Name: suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_status ON public.suggestions USING btree (status);


--
-- Name: suggestions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_user_id ON public.suggestions USING btree (user_id);


--
-- Name: suggestions_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_user_unread ON public.suggestions USING btree (user_unread);


--
-- Name: unique_flock_per_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_flock_per_unit ON public.flocks USING btree (customer_id, unit_id, flock_number);


--
-- Name: unique_week_per_flock; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_week_per_flock ON public.weekly_management USING btree (chick_placement_id, week_number);


--
-- Name: units_customer_personal_information_id_unit_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_customer_personal_information_id_unit_name ON public.units USING btree (customer_personal_information_id, unit_name);


--
-- Name: uq_customer_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_code ON public.customer_personal_information USING btree (customer_code);


--
-- Name: users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_created_at ON public.users USING btree (created_at);


--
-- Name: users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email ON public.users USING btree (email);


--
-- Name: users_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_mobile_number ON public.users USING btree (mobile_number);


--
-- Name: users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role ON public.users USING btree (role);


--
-- Name: users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_status ON public.users USING btree (status);


--
-- Name: users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username ON public.users USING btree (username);


--
-- Name: hall_physical_info trigger_hall_area_calculation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_hall_area_calculation BEFORE INSERT OR UPDATE ON public.hall_physical_info FOR EACH ROW EXECUTE FUNCTION public.calculate_hall_area();


--
-- Name: hall_physical_info trigger_hall_physical_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_hall_physical_updated_at BEFORE UPDATE ON public.hall_physical_info FOR EACH ROW EXECUTE FUNCTION public.update_hall_physical_updated_at();


--
-- Name: customer_personal_information trigger_update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON public.customer_personal_information FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users trigger_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bookmarks update_bookmarks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bookmarks_updated_at BEFORE UPDATE ON public.bookmarks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_logs update_sms_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_logs_updated_at BEFORE UPDATE ON public.sms_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: bookmarks bookmarks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bookmarks bookmarks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE;


--
-- Name: bookmarks bookmarks_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_flock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_flock_id_fkey FOREIGN KEY (flock_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_flock_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_flock_period_id_fkey FOREIGN KEY (flock_period_id) REFERENCES public.flocks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bookmarks bookmarks_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bookmarks bookmarks_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: breed_weight_standards breed_weight_standards_breed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards
    ADD CONSTRAINT breed_weight_standards_breed_id_fkey FOREIGN KEY (breed_id) REFERENCES public.chicken_breeds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: breed_weight_standards breed_weight_standards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards
    ADD CONSTRAINT breed_weight_standards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: breed_weight_standards breed_weight_standards_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breed_weight_standards
    ADD CONSTRAINT breed_weight_standards_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: chick_placements chick_placements_breed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_breed_id_fkey FOREIGN KEY (breed_id) REFERENCES public.chicken_breeds(id) ON UPDATE CASCADE;


--
-- Name: chick_placements chick_placements_chick_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_chick_source_id_fkey FOREIGN KEY (chick_source_id) REFERENCES public.chick_sources(id) ON UPDATE CASCADE;


--
-- Name: chick_placements chick_placements_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chick_placements chick_placements_flock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_flock_id_fkey FOREIGN KEY (flock_id) REFERENCES public.flocks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chick_placements chick_placements_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chick_placements chick_placements_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chick_placements
    ADD CONSTRAINT chick_placements_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: crop_test crop_test_chick_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test
    ADD CONSTRAINT crop_test_chick_placement_id_fkey FOREIGN KEY (chick_placement_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: crop_test crop_test_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test
    ADD CONSTRAINT crop_test_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id);


--
-- Name: crop_test crop_test_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test
    ADD CONSTRAINT crop_test_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: crop_test crop_test_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_test
    ADD CONSTRAINT crop_test_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customer_personal_information customer_personal_information_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_personal_information customer_personal_information_customer_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_customer_type_id_fkey FOREIGN KEY (customer_type_id) REFERENCES public.customer_types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_personal_information customer_personal_information_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_personal_information
    ADD CONSTRAINT customer_personal_information_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: flock_completions fk_flock_completions_completed_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT fk_flock_completions_completed_by FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: flock_completions fk_flock_completions_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT fk_flock_completions_customer FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON DELETE CASCADE;


--
-- Name: flock_completions fk_flock_completions_hall; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT fk_flock_completions_hall FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON DELETE CASCADE;


--
-- Name: weekly_management fk_weekly_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management
    ADD CONSTRAINT fk_weekly_customer FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id);


--
-- Name: weekly_management fk_weekly_hall; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management
    ADD CONSTRAINT fk_weekly_hall FOREIGN KEY (hall_id) REFERENCES public.halls(id);


--
-- Name: flock_completion_halls flock_completion_halls_chick_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls
    ADD CONSTRAINT flock_completion_halls_chick_placement_id_fkey FOREIGN KEY (chick_placement_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE;


--
-- Name: flock_completion_halls flock_completion_halls_flock_completion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls
    ADD CONSTRAINT flock_completion_halls_flock_completion_id_fkey FOREIGN KEY (flock_completion_id) REFERENCES public.flock_completions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flock_completion_halls flock_completion_halls_flock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls
    ADD CONSTRAINT flock_completion_halls_flock_id_fkey FOREIGN KEY (flock_id) REFERENCES public.flocks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: flock_completion_halls flock_completion_halls_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completion_halls
    ADD CONSTRAINT flock_completion_halls_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE;


--
-- Name: flock_completions flock_completions_chick_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT flock_completions_chick_placement_id_fkey FOREIGN KEY (chick_placement_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flock_completions flock_completions_flock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT flock_completions_flock_id_fkey FOREIGN KEY (flock_id) REFERENCES public.flocks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flock_completions flock_completions_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flock_completions
    ADD CONSTRAINT flock_completions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: flocks flocks_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flocks
    ADD CONSTRAINT flocks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flocks flocks_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flocks
    ADD CONSTRAINT flocks_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_hygiene hall_hygiene_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_hygiene
    ADD CONSTRAINT hall_hygiene_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_hygiene hall_hygiene_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_hygiene
    ADD CONSTRAINT hall_hygiene_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_hygiene hall_hygiene_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_hygiene
    ADD CONSTRAINT hall_hygiene_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_physical_info hall_physical_info_floor_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_physical_info
    ADD CONSTRAINT hall_physical_info_floor_type_id_fkey FOREIGN KEY (floor_type_id) REFERENCES public.floor_types(id);


--
-- Name: hall_physical_info hall_physical_info_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_physical_info
    ADD CONSTRAINT hall_physical_info_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_physical_info hall_physical_info_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_physical_info
    ADD CONSTRAINT hall_physical_info_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_system_items hall_system_items_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_system_items
    ADD CONSTRAINT hall_system_items_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.hall_systems(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_systems hall_systems_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_systems
    ADD CONSTRAINT hall_systems_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_systems hall_systems_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_systems
    ADD CONSTRAINT hall_systems_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_water_feed hall_water_feed_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_water_feed
    ADD CONSTRAINT hall_water_feed_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hall_water_feed hall_water_feed_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hall_water_feed
    ADD CONSTRAINT hall_water_feed_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: halls halls_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.halls
    ADD CONSTRAINT halls_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: halls halls_service_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.halls
    ADD CONSTRAINT halls_service_expert_id_fkey FOREIGN KEY (service_expert_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: halls halls_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.halls
    ADD CONSTRAINT halls_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: periods periods_customer_personal_information_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_customer_personal_information_id_fkey FOREIGN KEY (customer_personal_information_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_note_items release_note_items_release_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_items
    ADD CONSTRAINT release_note_items_release_note_id_fkey FOREIGN KEY (release_note_id) REFERENCES public.release_notes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_note_views release_note_views_release_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_views
    ADD CONSTRAINT release_note_views_release_note_id_fkey FOREIGN KEY (release_note_id) REFERENCES public.release_notes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: release_note_views release_note_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_note_views
    ADD CONSTRAINT release_note_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sms_logs sms_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sms_logs sms_logs_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: suggestion_messages suggestion_messages_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_messages
    ADD CONSTRAINT suggestion_messages_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: suggestions suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: unit_experts unit_experts_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_experts
    ADD CONSTRAINT unit_experts_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: units units_customer_personal_information_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_customer_personal_information_id_fkey FOREIGN KEY (customer_personal_information_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: units units_unit_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_unit_status_id_fkey FOREIGN KEY (unit_status_id) REFERENCES public.unit_statuses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: visit_report_attachments visit_report_attachments_visit_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_attachments
    ADD CONSTRAINT visit_report_attachments_visit_report_id_fkey FOREIGN KEY (visit_report_id) REFERENCES public.visit_reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_report_experts visit_report_experts_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_experts
    ADD CONSTRAINT visit_report_experts_expert_id_fkey FOREIGN KEY (expert_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_report_experts visit_report_experts_visit_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_experts
    ADD CONSTRAINT visit_report_experts_visit_report_id_fkey FOREIGN KEY (visit_report_id) REFERENCES public.visit_reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_report_halls visit_report_halls_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_halls
    ADD CONSTRAINT visit_report_halls_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_report_halls visit_report_halls_visit_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_report_halls
    ADD CONSTRAINT visit_report_halls_visit_report_id_fkey FOREIGN KEY (visit_report_id) REFERENCES public.visit_reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_reports visit_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: visit_reports visit_reports_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_personal_information(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: visit_reports visit_reports_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_diseases weekly_diseases_disease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_diseases
    ADD CONSTRAINT weekly_diseases_disease_id_fkey FOREIGN KEY (disease_id) REFERENCES public.diseases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_diseases weekly_diseases_weekly_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_diseases
    ADD CONSTRAINT weekly_diseases_weekly_management_id_fkey FOREIGN KEY (weekly_management_id) REFERENCES public.weekly_management(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_feeds weekly_feeds_feed_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_feeds
    ADD CONSTRAINT weekly_feeds_feed_type_id_fkey FOREIGN KEY (feed_type_id) REFERENCES public.feed_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_feeds weekly_feeds_weekly_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_feeds
    ADD CONSTRAINT weekly_feeds_weekly_management_id_fkey FOREIGN KEY (weekly_management_id) REFERENCES public.weekly_management(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_management weekly_management_chick_placement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management
    ADD CONSTRAINT weekly_management_chick_placement_id_fkey FOREIGN KEY (chick_placement_id) REFERENCES public.chick_placements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_management weekly_management_service_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_management
    ADD CONSTRAINT weekly_management_service_expert_id_fkey FOREIGN KEY (service_expert_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: weekly_medicines weekly_medicines_medicine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_medicines
    ADD CONSTRAINT weekly_medicines_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_medicines weekly_medicines_weekly_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_medicines
    ADD CONSTRAINT weekly_medicines_weekly_management_id_fkey FOREIGN KEY (weekly_management_id) REFERENCES public.weekly_management(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_suggestions weekly_suggestions_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_suggestions
    ADD CONSTRAINT weekly_suggestions_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.suggestion_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_suggestions weekly_suggestions_weekly_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_suggestions
    ADD CONSTRAINT weekly_suggestions_weekly_management_id_fkey FOREIGN KEY (weekly_management_id) REFERENCES public.weekly_management(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_vaccines weekly_vaccines_vaccine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_vaccines
    ADD CONSTRAINT weekly_vaccines_vaccine_id_fkey FOREIGN KEY (vaccine_id) REFERENCES public.vaccines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_vaccines weekly_vaccines_weekly_management_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_vaccines
    ADD CONSTRAINT weekly_vaccines_weekly_management_id_fkey FOREIGN KEY (weekly_management_id) REFERENCES public.weekly_management(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict zyZ6llTgUP85TZDraX475l72LysfZ95pGiieQtoxjjFqlTM4oUO3GLlBy90No0f

